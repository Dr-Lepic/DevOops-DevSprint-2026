import { Worker, Job, Queue } from 'bullmq';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { metricsHandler, jobsProcessedTotal, jobProcessingDuration, jobsActive, jobsWaiting } from './metrics';
import {
  getProcessingState,
  markProcessing,
  markCooked,
  markCompleted,
  closeIdempotencyRedis,
} from './services/idempotencyService';

interface OrderJob {
  studentId: string;
  itemId: string;
  quantity: number;
  orderId: string;
}

const redisConnection = {
  host: config.redisUrl.includes('://')
    ? new URL(config.redisUrl).hostname
    : config.redisUrl.split(':')[0],
  port: config.redisUrl.includes('://')
    ? parseInt(new URL(config.redisUrl).port || '6379')
    : parseInt(config.redisUrl.split(':')[1] || '6379'),
};

// Queue instance for health check stats
const queue = new Queue(config.queueName, { connection: redisConnection });

// ─── BullMQ Worker with Two-Phase Idempotent Processing ───

const worker = new Worker<OrderJob>(
  config.queueName,
  async (job: Job<OrderJob>) => {
    const { studentId, orderId, itemId, quantity } = job.data;
    const timer = jobProcessingDuration.startTimer();

    console.log(`🍳 Processing order ${orderId} for student ${studentId}`);
    console.log(`📦 Item: ${itemId}, Quantity: ${quantity}`);

    // Phase 0: Check idempotency state
    const state = await getProcessingState(orderId);

    if (state === 'completed') {
      console.log(`⏭️ Order ${orderId} already completed, skipping`);
      jobsProcessedTotal.inc({ result: 'success' });
      timer();
      return;
    }

    if (state === 'cooked') {
        console.log(`⏭️ Order ${orderId} already cooked, retrying notification only`);
      } else {
        // Phase 1: Cook
        await markProcessing(orderId);

        const cookingTime = Math.random() * 4000 + 3000; // 3000ms to 7000ms
        console.log(`⏳ Cooking time: ${Math.round(cookingTime / 1000)}s`);

        await new Promise((resolve) => setTimeout(resolve, cookingTime));

        // Chaos injection: 10% chance to fail cooking
        if (config.chaosEnabled && Math.random() < 0.1) {
          console.error(`💥 CHAOS: Randomly failing worker for order ${orderId}`);
          throw new Error('Chaos Engineering Failure in Kitchen Queue');
        }

      await markCooked(orderId);
      console.log(`✅ Order ${orderId} cooked!`);
    }

    // Phase 2: Notify
    try {
      await axios.post(`${config.notificationHubUrl}/notify`, {
        studentId,
        orderId,
        status: 'Ready',
      });
      console.log(`📢 Notification sent for order ${orderId}`);

      await markCompleted(orderId);
    } catch (error) {
      console.error(`❌ Failed to notify for order ${orderId}:`, error);
      throw error; // Re-throw to trigger BullMQ retry (will skip cooking on retry)
    }

    jobsProcessedTotal.inc({ result: 'success' });
    timer();
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
  jobsProcessedTotal.inc({ result: 'failure' });
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// ─── Express HTTP Server for /health and /metrics ───

const app = express();
app.use(cors());
app.use(express.json());

app.get('/metrics', metricsHandler);

app.get('/health', async (req, res) => {
  let redisStatus = 'down';
  let queueStats = { waiting: 0, active: 0, completed: 0, failed: 0 };

  try {
    await queue.client;
    redisStatus = 'up';
    queueStats = {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      completed: await queue.getCompletedCount(),
      failed: await queue.getFailedCount(),
    };
    // Update gauges
    jobsWaiting.set(queueStats.waiting);
    jobsActive.set(queueStats.active);
  } catch {}

  const overallStatus = redisStatus === 'up' ? 'healthy' : 'degraded';

  res.status(200).json({
    status: overallStatus,
    service: 'kitchen-queue',
    uptime: process.uptime(),
    dependencies: {
      redis: redisStatus,
    },
    queue: queueStats,
  });
});

app.listen(config.port, () => {
  console.log(`📊 Kitchen Queue metrics server on port ${config.port}`);
});

console.log('🚀 Kitchen Queue Worker started');
console.log(`📝 Environment: ${config.nodeEnv}`);
console.log(`🔗 Redis URL: ${config.redisUrl}`);
console.log(`📡 Notification Hub URL: ${config.notificationHubUrl}`);
console.log(`📋 Queue Name: ${config.queueName}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await worker.close();
  await queue.close();
  await closeIdempotencyRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await worker.close();
  process.exit(0);
});
