import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger.js';
import { connectRedis } from './utils/redis.js';
import { prisma } from './utils/prisma.js';

// Routes
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import segmentRoutes from './routes/segments.js';
import campaignRoutes from './routes/campaigns.js';
import receiptRoutes from './routes/receipts.js';
import analyticsRoutes from './routes/analytics.js';
import aiRoutes from './routes/ai.js';
import ingestRoutes from './routes/ingest.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Security & Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// AI routes get a more generous limit
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'AI rate limit reached, please slow down.' }
});

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/ingest', ingestRoutes);

// Health check
app.get('/health', async (req, res) => {
  const services = { database: 'down', api: 'up', channelService: 'down' };
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'up';
  } catch (err) { /* ignore */ }

  try {
    const channelRes = await fetch(process.env.CHANNEL_SERVICE_URL || 'http://localhost:5000/health');
    if (channelRes.ok) services.channelService = 'up';
  } catch (err) { /* ignore */ }

  const status = (services.database === 'up' && services.channelService === 'up') ? 'healthy' : 'degraded';
  res.status(status === 'healthy' ? 200 : 207).json({
    status,
    timestamp: new Date().toISOString(),
    services
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');

    await connectRedis();
    logger.info('✅ Redis connected');

    app.listen(PORT, () => {
      logger.info(`🚀 Xeno CRM Backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
