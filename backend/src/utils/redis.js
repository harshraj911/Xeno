import { createClient } from 'redis';
import IORedis from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Standard Redis client for caching
export const redisClient = createClient({ 
  url: REDIS_URL,
  socket: { family: 0 }
});

redisClient.on('error', (err) => logger.error('Redis client error:', err));
redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

export async function connectRedis() {
  await redisClient.connect();
}

// IORedis connection for BullMQ
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  family: 0
});

// Cache helpers
export const cache = {
  async get(key) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn(`Cache set failed for ${key}:`, err.message);
    }
  },

  async del(key) {
    try {
      await redisClient.del(key);
    } catch {}
  },

  async invalidatePattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(keys);
    } catch {}
  }
};
