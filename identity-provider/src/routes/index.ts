import express from 'express';
import { login } from '../controllers/authController';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { metricsHandler } from '../metrics';
import { createClient } from 'redis';
import { config } from '../config/env';
import { getServiceKilled, setServiceKilled } from '../middlewares/chaosMiddleware';

const router = express.Router();

// Redis client for health checks
const healthRedis = createClient({ url: config.redisUrl });
healthRedis.connect().catch(() => {});
healthRedis.on('error', () => {});

// Routes
router.post('/login', loginRateLimiter, login);

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

// Chaos engineering endpoints
router.get('/chaos/state', (req, res) => {
  res.json({
    killed: getServiceKilled(),
    service: 'identity-provider',
  });
});

router.post('/chaos/kill', (req, res) => {
  setServiceKilled(true);
  console.warn('🔴 CHAOS: Service kill switch activated');
  res.json({ status: 'killed', message: 'Service will now return 503 for all requests (except health/metrics/chaos)' });
});

router.post('/chaos/recover', (req, res) => {
  setServiceKilled(false);
  console.log('✅ CHAOS: Service kill switch deactivated');
  res.json({ status: 'recovered', message: 'Service is now operational' });
});

// Enhanced health check endpoint
router.get('/health', async (req, res) => {
  let redisStatus = 'down';
  try {
    const pong = await healthRedis.ping();
    if (pong === 'PONG') redisStatus = 'up';
  } catch {}

  const isKilled = getServiceKilled();
  const overallStatus = isKilled ? 'down' : (redisStatus === 'up' ? 'healthy' : 'degraded');

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    service: 'identity-provider',
    uptime: process.uptime(),
    dependencies: {
      redis: redisStatus,
    },
  });
});

export default router;
