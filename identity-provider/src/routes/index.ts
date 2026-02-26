import express from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { login } from '../controllers/authController';
import { config } from '../config/env';

const router = express.Router();

// Create Redis client for rate limiting
const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect().catch(console.error);

// Rate limiter configuration
const loginLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 3, // Limit each IP to 3 requests per windowMs
  message: { error: 'Too many login attempts, please try again after a minute' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Key generator to use studentId from body if available, otherwise IP
  keyGenerator: (req) => {
    return req.body?.studentId || req.ip || 'unknown';
  },
});

// Routes
router.post('/login', loginLimiter, login);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'identity-provider' });
});

export default router;
