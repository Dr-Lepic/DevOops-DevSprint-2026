import express from 'express';
import { deductStock } from '../controllers/stockController';
import { metricsHandler } from '../metrics';
import { pool } from '../db/pool';
import { redisClient } from '../cache/redis';

const router = express.Router();

router.post('/deduct', deductStock);

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

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

  const overallStatus = postgresStatus === 'up' && redisStatus === 'up' ? 'healthy' : 'degraded';

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
