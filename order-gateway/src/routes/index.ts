import express from 'express';
import { placeOrder } from '../controllers/orderController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { metricsHandler } from '../metrics';
import { createClient } from 'redis';
import axios from 'axios';
import { config } from '../config/env';
import { getServiceKilled, setServiceKilled } from '../middlewares/chaosMiddleware';

const router = express.Router();

// Redis client for health checks
const healthRedis = createClient({ url: config.redisUrl });
healthRedis.connect().catch(() => {});
healthRedis.on('error', () => {});

router.post('/order', authMiddleware, placeOrder);

router.get('/chaos/state', (req, res) => {
  res.status(200).json({
    service: 'order-gateway',
    killed: getServiceKilled(),
  });
});

router.post('/chaos/kill', (req, res) => {
  setServiceKilled(true);
  res.status(200).json({
    service: 'order-gateway',
    killed: true,
  });
});

router.post('/chaos/recover', (req, res) => {
  setServiceKilled(false);
  res.status(200).json({
    service: 'order-gateway',
    killed: false,
  });
});

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

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
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
