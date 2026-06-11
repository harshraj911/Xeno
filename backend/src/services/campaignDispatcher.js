import { Queue, Worker, QueueEvents } from 'bullmq';
import axios from 'axios';
import { prisma } from '../utils/prisma.js';
import { redisConnection } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5000';

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
    const commsData = customers.map((customer) => ({
      campaignId,
      customerId: customer.id,
      channel: campaign.channel,
      message: personalizeMessage(campaign.messageTemplate, customer),
      status: 'queued'
    }));

    // Batch insert
    const BATCH_SIZE = 500;
    for (let i = 0; i < commsData.length; i += BATCH_SIZE) {
      await prisma.communication.createMany({
        data: commsData.slice(i, i + BATCH_SIZE)
      });
    }

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalSent: customers.length }
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

    } catch (err) {
      logger.error(`Failed to send message ${communicationId}:`, err.message);
      await prisma.communication.update({
        where: { id: communicationId },
        data: {
          status: 'failed',
          failureReason: err.message,
          failedAt: new Date(),
          retryCount: { increment: 1 }
        }
      });

      // Update campaign failed count
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { totalFailed: { increment: 1 } }
      });

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

messageWorker.on('failed', (job, err) => {
  logger.error(`Message job ${job?.id} failed after retries:`, err.message);
});

// Personalize message template
function personalizeMessage(template, customer) {
  return template
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
