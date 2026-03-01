import express from 'express';
import { login } from '../controllers/authController';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { metricsHandler } from '../metrics';
import { createClient } from 'redis';
import { config } from '../config/env';

const router = express.Router();

// Redis client for health checks
const healthRedis = createClient({ url: config.redisUrl });
healthRedis.connect().catch(() => {});
healthRedis.on('error', () => {});

// Routes
router.post('/login', loginRateLimiter, login);

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

// Enhanced health check endpoint
router.get('/health', async (req, res) => {
  let redisStatus = 'down';
  try {
    const pong = await healthRedis.ping();
    if (pong === 'PONG') redisStatus = 'up';
  } catch {}

  const overallStatus = redisStatus === 'up' ? 'healthy' : 'degraded';

  res.status(200).json({
    status: overallStatus,
    service: 'identity-provider',
    uptime: process.uptime(),
    dependencies: {
      redis: redisStatus,
    },
  });
});

export default router;
