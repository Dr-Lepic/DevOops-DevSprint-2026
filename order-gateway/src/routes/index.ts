import express from 'express';
import { placeOrder } from '../controllers/orderController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { metricsHandler } from '../metrics';
import { createClient } from 'redis';
import axios from 'axios';
import { config } from '../config/env';

const router = express.Router();

// Redis client for health checks
const healthRedis = createClient({ url: config.redisUrl });
healthRedis.connect().catch(() => {});
healthRedis.on('error', () => {});

router.post('/order', authMiddleware, placeOrder);

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

// Enhanced health check endpoint
router.get('/health', async (req, res) => {
  let redisStatus = 'down';
  let stockServiceStatus = 'down';

  try {
    const pong = await healthRedis.ping();
    if (pong === 'PONG') redisStatus = 'up';
  } catch {}

  try {
    const resp = await axios.get(`${config.stockServiceUrl.replace('/deduct', '')}/health`, { timeout: 2000 });
    if (resp.status === 200) stockServiceStatus = 'up';
  } catch {}

  const overallStatus = redisStatus === 'up' && stockServiceStatus === 'up' ? 'healthy' : 'degraded';

  res.status(200).json({
    status: overallStatus,
    service: 'order-gateway',
    uptime: process.uptime(),
    dependencies: {
      redis: redisStatus,
      stockService: stockServiceStatus,
    },
  });
});

export default router;
