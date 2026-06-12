import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import { prisma } from '../utils/prisma.js';
import { redisConnection } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

// ── Completion helper ───────────────────────────────────────────────────────
// Called after every terminal message outcome. Marks the campaign as
// 'completed' once all communications have settled (sent/delivered/failed).
export async function checkCampaignCompletion(campaignId) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true, totalRecipients: true }
    });

    if (!campaign || (campaign.status !== 'running' && campaign.status !== 'paused')) return;
    
    // Recalculate terminal counts to be the source of truth
    const terminalStats = await prisma.communication.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { id: true }
    });

    const statusMap = terminalStats.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {});

    const deliveredCount = (statusMap.delivered || 0) + (statusMap.opened || 0) + (statusMap.read || 0) + (statusMap.clicked || 0) + (statusMap.converted || 0);
    const successSentCount = (statusMap.sent || 0) + deliveredCount;
    const failedCount = statusMap.failed || 0;
    const terminalCount = (statusMap.sent || 0) + deliveredCount + failedCount;

    // Use the stored totalRecipients for comparison
    const targetCount = campaign.totalRecipients || 0;

    if (targetCount > 0 && terminalCount >= targetCount) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalFailed: failedCount,
          totalDelivered: deliveredCount,
          totalSent: successSentCount
        }
      });
      logger.info(`✅ Campaign ${campaignId} completed: ${terminalCount}/${targetCount} handled (Success: ${successSentCount}, Fail: ${failedCount})`);
    } else {
      // Periodic update of counters even if not complete
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalFailed: failedCount,
          totalDelivered: deliveredCount,
          totalSent: successSentCount
        }
      });
    }
  } catch (err) {
    logger.error(`checkCampaignCompletion error for ${campaignId}:`, err.message);
  }
}

let CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5000';
if (CHANNEL_SERVICE_URL && !CHANNEL_SERVICE_URL.startsWith('http')) {
  const isPublic = CHANNEL_SERVICE_URL.includes('onrender.com');
  const protocol = isPublic ? 'https' : 'http';
  // If internal render host, it needs the port (5000 for channel service)
  const needsPort = !isPublic && !CHANNEL_SERVICE_URL.includes(':') && !CHANNEL_SERVICE_URL.includes('localhost');
  CHANNEL_SERVICE_URL = `${protocol}://${CHANNEL_SERVICE_URL}${needsPort ? ':5000' : ''}`;
}

// Queue definitions
export const campaignQueue = new Queue('campaign-dispatch', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

export const messageQueue = new Queue('message-send', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 500
  }
});

// Campaign dispatch worker - processes one campaign at a time
const campaignWorker = new Worker(
  'campaign-dispatch',
  async (job) => {
    const { campaignId } = job.data;
    logger.info(`Processing campaign dispatch: ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        segment: {
          include: { members: { include: { customer: true } } }
        }
      }
    });

    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    if (campaign.status !== 'running') {
      logger.warn(`Campaign ${campaignId} is not in running state, skipping`);
      return;
    }

    const customers = campaign.segment.members.map((m) => m.customer);
    logger.info(`Dispatching to ${customers.length} customers for campaign ${campaignId}`);

    // Create all communication records first
    const commsData = customers.map((customer) => {
      let channel = campaign.channel;
      let template = campaign.messageTemplate;

      if (channel === 'omnichannel') {
        channel = customer.channel || 'email';
        if (campaign.templates && campaign.templates[channel]) {
          template = campaign.templates[channel];
        }
      }

      return {
        campaignId,
        customerId: customer.id,
        channel,
        message: personalizeMessage(template, customer),
        status: 'queued'
      };
    });

    // Batch insert
    const BATCH_SIZE = 500;
    for (let i = 0; i < commsData.length; i += BATCH_SIZE) {
      await prisma.communication.createMany({
        data: commsData.slice(i, i + BATCH_SIZE)
      });
    }

    // Update campaign total recipient count
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: customers.length, totalSent: 0 }
    });

    // Enqueue individual send jobs
    const allComms = await prisma.communication.findMany({
      where: { campaignId, status: 'queued' },
      select: { id: true, customerId: true, channel: true, message: true }
    });

    const jobs = allComms.map((comm) => ({
      name: 'send-message',
      data: { communicationId: comm.id, campaignId, ...comm },
      opts: { delay: Math.floor(Math.random() * 2000) } // Stagger sends
    }));

    // Add in batches
    for (let i = 0; i < jobs.length; i += 100) {
      await messageQueue.addBulk(jobs.slice(i, i + 100));
    }

    logger.info(`Campaign ${campaignId}: ${allComms.length} messages queued`);
  },
  { connection: redisConnection, concurrency: 2 }
);

// Message send worker - calls channel service
const messageWorker = new Worker(
  'message-send',
  async (job) => {
    const { communicationId, campaignId, customerId, channel, message } = job.data;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, phone: true, name: true }
    });

    if (!customer) {
      await prisma.communication.update({
        where: { id: communicationId },
        data: { status: 'failed', failureReason: 'Customer not found', failedAt: new Date() }
      });
      await checkCampaignCompletion(campaignId);
      return;
    }

    try {
      // Call channel service
      const response = await axios.post(`${CHANNEL_SERVICE_URL}/send`, {
        messageId: communicationId,
        campaignId,
        recipient: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          name: customer.name
        },
        channel,
        message
      }, { timeout: 10000 });

      await prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: 'sent',
          externalMsgId: response.data.messageId,
          sentAt: new Date()
        }
      });

      // Check if campaign is now complete
      await checkCampaignCompletion(campaignId);

    } catch (err) {
      const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 3) - 1;
      
      logger.error(`Failed to send message ${communicationId} (attempt ${job.attemptsMade + 1}):`, err.message);
      
      await prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: 'failed',
          failureReason: err.message,
          failedAt: new Date(),
          retryCount: { increment: 1 }
        }
      });

      // We DON'T manually increment totalFailed here anymore. 
      // checkCampaignCompletion will recalculate it accurately.
      await checkCampaignCompletion(campaignId);

      throw err; // Let BullMQ handle retry
    }
  },
  { connection: redisConnection, concurrency: 20 }
);

// Error handlers
campaignWorker.on('failed', (job, err) => {
  logger.error(`Campaign job ${job?.id} failed:`, err.message);
  if (job?.data?.campaignId) {
    prisma.campaign.update({
      where: { id: job.data.campaignId },
      data: { status: 'failed' }
    }).catch(() => {});
  }
});

messageWorker.on('completed', (job) => {
  logger.debug(`Message job ${job.id} completed`);
});

// BullMQ v5: 'failed' fires only when ALL retries are exhausted
messageWorker.on('failed', async (job, err) => {
  if (!job) return;
  logger.warn(`Message job ${job.id} finally failed after ${job.attemptsMade} attempts: ${err.message}`);
  if (job.data?.campaignId) {
    await checkCampaignCompletion(job.data.campaignId);
  }
});

// Personalize message template
function personalizeMessage(template, customer) {
  return (template || '')
    .replace(/{{name}}/gi, customer.name || 'Valued Customer')
    .replace(/{{email}}/gi, customer.email || '')
    .replace(/{{city}}/gi, customer.city || '')
    .replace(/{{first_name}}/gi, (customer.name || '').split(' ')[0] || 'there');
}

export async function dispatchCampaign(campaignId) {
  await campaignQueue.add('dispatch', { campaignId }, {
    jobId: `campaign-${campaignId}`
  });
}

export { campaignWorker, messageWorker };
