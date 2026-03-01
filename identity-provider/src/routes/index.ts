import express from 'express';
import { login } from '../controllers/authController';
import { loginRateLimiter } from '../middlewares/rateLimiter';
<<<<<<< HEAD

const router = express.Router();

// Routes
router.post('/login', loginRateLimiter, login);
=======
import { metricsHandler } from '../metrics';
import { createClient } from 'redis';
import { config } from '../config/env';

const router = express.Router();

// Redis client for health checks
const healthRedis = createClient({ url: config.redisUrl });
healthRedis.connect().catch(() => {});
healthRedis.on('error', () => {});
>>>>>>> 8d85275998680e1dfc59dd67db7294b3a25d50f9

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
