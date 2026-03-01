import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/env';

const redisClient = createClient({ url: config.redisUrl });

redisClient.connect().catch((err) => {
  console.error('Rate-limit Redis connection error:', err);
});

redisClient.on('error', (err) => {
  console.error('Rate-limit Redis client error:', err);
});

/**
 * Rate limiter for /login: 3 requests per 1-minute window.
 * Keyed by IP or studentId from the request body.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
  keyGenerator: (req) => {
    // Use studentId from body if available, otherwise fall back to IP
    const studentId = req.body?.studentId;
    return studentId ? `login:${studentId}` : `login:${req.ip}`;
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
});
