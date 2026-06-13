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

    if (!campaign || !['running', 'paused', 'completed'].includes(campaign.status)) return;
    
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

    if (campaign.status !== 'completed' && targetCount > 0 && terminalCount >= targetCount) {
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
      // Periodic update of counters even if not complete, or if already marked as complete
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

import { resolveServiceUrl } from '../utils/urlResolver.js';

let CHANNEL_SERVICE_URL = resolveServiceUrl(process.env.CHANNEL_SERVICE_URL, '5030');

async function getChannelServiceUrl() {
  const internal = resolveServiceUrl(process.env.CHANNEL_SERVICE_URL, '5030');
  const publicUrl = process.env.CHANNEL_SERVICE_PUBLIC_URL;
  
  // Quick check if internal is alive
  try {
    await axios.get(`${internal}/health`, { timeout: 1000 });
    return internal;
  } catch (err) {
    if (publicUrl) return publicUrl;
    return internal;
  }
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

    // Update campaign total recipient count IMMEDIATELY so UI reflects it
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: customers.length, totalSent: 0 }
    });

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

    // totalRecipients already updated at the start of the worker

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
      // Call channel service with dynamic URL resolution
      const targetUrl = await getChannelServiceUrl();
      const response = await axios.post(`${targetUrl}/send`, {
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
      }, { 
        timeout: 10000,
        headers: { 'X-Xeno-Attempt': job.attemptsMade + 1 }
      });

      await prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: 'sent',
          externalMsgId: response.data.messageId,
          sentAt: new Date()
        }
      });

      await checkCampaignCompletion(campaignId);

    } catch (err) {
      const errorMsg = err.response
        ? `Channel Service Error (${err.response.status}): ${JSON.stringify(err.response.data)}`
        : `Network Error: ${err.message}`;
      
      logger.error(`Failed to dispatch message ${communicationId}: ${errorMsg}`);
      
      await prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: 'failed',
          failureReason: errorMsg,
          failedAt: new Date(),
          retryCount: { increment: 1 }
        }
      });

      await checkCampaignCompletion(campaignId);
      throw err;
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
