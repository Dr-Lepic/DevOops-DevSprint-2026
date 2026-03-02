import express from 'express';
import { deductStock } from '../controllers/stockController';
import { metricsHandler } from '../metrics';
import { pool } from '../db/pool';
import { redisClient } from '../cache/redis';
import { getServiceKilled, setServiceKilled } from '../middlewares/chaosMiddleware';

const router = express.Router();

router.post('/deduct', deductStock);

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

// Chaos engineering endpoints
router.get('/chaos/state', (req, res) => {
  res.json({
    killed: getServiceKilled(),
    service: 'stock-service',
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
  let postgresStatus = 'down';
  let redisStatus = 'down';

  try {
    const result = await pool.query('SELECT 1');
    if (result.rowCount === 1) postgresStatus = 'up';
  } catch {}

  try {
    const pong = await redisClient.ping();
    if (pong === 'PONG') redisStatus = 'up';
  } catch {}

  const isKilled = getServiceKilled();
  const overallStatus = isKilled ? 'down' : (postgresStatus === 'up' && redisStatus === 'up' ? 'healthy' : 'degraded');

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    service: 'stock-service',
    uptime: process.uptime(),
    dependencies: {
      postgres: postgresStatus,
      redis: redisStatus,
    },
  });
});

export default router;
