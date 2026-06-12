import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import winston from 'winston';

const app = express();
const PORT = process.env.PORT || 5000;
let CRM_CALLBACK_URL = process.env.CRM_CALLBACK_URL || 'http://localhost:4000/api/receipts/callback';
if (CRM_CALLBACK_URL && !CRM_CALLBACK_URL.startsWith('http')) {
  CRM_CALLBACK_URL = `https://${CRM_CALLBACK_URL}/api/receipts/callback`;
}
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [new winston.transports.Console()]
});

// Redis connection
const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  family: 0
});

// Delivery queue
const deliveryQueue = new Queue('channel-delivery', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 100
  }
});

// Channel-specific delivery profiles
const CHANNEL_PROFILES = {
  whatsapp: {
    deliverySuccessRate: 0.95,
    openRate: 0.70,
    readRate: 0.65,
    clickRate: 0.25,
    conversionRate: 0.08,
    deliveryDelayMs: [500, 3000],
    openDelayMs: [2000, 30000],
    readDelayMs: [5000, 120000],
    clickDelayMs: [10000, 300000]
  },
  sms: {
    deliverySuccessRate: 0.98,
    openRate: 0.45,
    readRate: 0.40,
    clickRate: 0.08,
    conversionRate: 0.04,
    deliveryDelayMs: [200, 1500],
    openDelayMs: [1000, 20000],
    readDelayMs: [2000, 60000],
    clickDelayMs: [5000, 120000]
  },
  email: {
    deliverySuccessRate: 0.92,
    openRate: 0.25,
    readRate: 0.20,
    clickRate: 0.05,
    conversionRate: 0.02,
    deliveryDelayMs: [1000, 5000],
    openDelayMs: [10000, 600000],
    readDelayMs: [20000, 1800000],
    clickDelayMs: [30000, 3600000]
  },
  rcs: {
    deliverySuccessRate: 0.88,
    openRate: 0.55,
    readRate: 0.50,
    clickRate: 0.20,
    conversionRate: 0.06,
    deliveryDelayMs: [800, 4000],
    openDelayMs: [3000, 60000],
    readDelayMs: [8000, 180000],
    clickDelayMs: [15000, 600000]
  }
};

const FAILURE_REASONS = [
  'Phone number not reachable',
  'User opted out',
  'Invalid phone number',
  'Network timeout',
  'Carrier blocked',
  'Account suspended',
  'Message too long'
];

function randomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min) + min);
}

async function sendCallback(events) {
  try {
    const payload = Array.isArray(events) ? events : [events];
    await axios.post(CRM_CALLBACK_URL, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json', 'X-Channel-Service': 'xeno-stub/1.0' }
    });
    logger.debug(`Callback sent: ${payload.map((e) => `${e.messageId}:${e.status}`).join(', ')}`);
  } catch (err) {
    logger.error(`Callback failed: ${err.message}`);
    throw err;
  }
}

// Delivery worker - processes send jobs and simulates the full lifecycle
const deliveryWorker = new Worker(
  'channel-delivery',
  async (job) => {
    const { messageId, campaignId, recipient, channel, message } = job.data;
    const profile = CHANNEL_PROFILES[channel] || CHANNEL_PROFILES.whatsapp;

    // Step 1: Delivery
    const deliveryDelay = randomInRange(profile.deliveryDelayMs);
    await new Promise((r) => setTimeout(r, deliveryDelay));

    const delivered = Math.random() < profile.deliverySuccessRate;

    if (!delivered) {
      const reason = FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
      await sendCallback({ messageId, status: 'failed', reason, metadata: { channel, campaignId } });
      return;
    }

    await sendCallback({ messageId, status: 'delivered', metadata: { channel, campaignId } });

    // Step 2: Opened
    if (Math.random() < profile.openRate) {
      const openDelay = randomInRange(profile.openDelayMs);
      setTimeout(async () => {
        await sendCallback({ messageId, status: 'opened', metadata: { channel } }).catch(() => {});

        // Step 3: Read
        if (Math.random() < profile.readRate) {
          const readDelay = randomInRange([2000, 10000]);
          setTimeout(async () => {
            await sendCallback({ messageId, status: 'read', metadata: { channel } }).catch(() => {});

            // Step 4: Clicked
            if (Math.random() < profile.clickRate) {
              const clickDelay = randomInRange([3000, 30000]);
              setTimeout(async () => {
                await sendCallback({ messageId, status: 'clicked', metadata: { channel } }).catch(() => {});

                // Step 5: Converted
                if (Math.random() < profile.conversionRate) {
                  const convDelay = randomInRange([5000, 60000]);
                  setTimeout(async () => {
                    await sendCallback({ messageId, status: 'converted', metadata: { channel } }).catch(() => {});
                  }, convDelay);
                }
              }, clickDelay);
            }
          }, readDelay);
        }
      }, openDelay);
    }
  },
  {
    connection: redisConnection,
    concurrency: 50, // Handle high volume
    limiter: { max: 200, duration: 1000 } // 200 jobs/second rate limit
  }
);

deliveryWorker.on('failed', (job, err) => {
  logger.error(`Delivery job ${job?.id} failed: ${err.message}`);
});

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// POST /send - receive send request from CRM
app.post('/send', async (req, res) => {
  try {
    const { messageId, campaignId, recipient, channel, message } = req.body;

    if (!messageId || !recipient || !channel) {
      return res.status(400).json({ error: 'messageId, recipient, and channel are required' });
    }

    // Queue the delivery job
    await deliveryQueue.add('deliver', {
      messageId,
      campaignId,
      recipient,
      channel,
      message
    }, {
      jobId: `deliver-${messageId}`,
      delay: Math.random() * 500 // slight initial jitter
    });

    res.json({
      messageId,
      status: 'accepted',
      estimatedDelivery: new Date(Date.now() + 3000).toISOString()
    });
  } catch (err) {
    logger.error('Send endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /send/batch - batch send
app.post('/send/batch', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

    const jobs = messages.map((msg) => ({
      name: 'deliver',
      data: msg,
      opts: { jobId: `deliver-${msg.messageId}`, delay: Math.random() * 1000 }
    }));

    await deliveryQueue.addBulk(jobs);

    res.json({ accepted: jobs.length, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /health
app.get('/health', async (req, res) => {
  const queueCounts = await deliveryQueue.getJobCounts();
  res.json({
    status: 'healthy',
    queue: queueCounts,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`📡 Channel Service running on port ${PORT}`);
  logger.info(`📞 Callbacks -> ${CRM_CALLBACK_URL}`);
});
