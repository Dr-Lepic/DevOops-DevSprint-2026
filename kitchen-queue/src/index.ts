import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { config } from './config/env';

interface OrderJob {
  studentId: string;
  itemId: string;
  quantity: number;
  orderId: string;
}

// Create BullMQ Worker
const worker = new Worker<OrderJob>(
  config.queueName,
  async (job: Job<OrderJob>) => {
    const { studentId, orderId, itemId, quantity } = job.data;

    console.log(`🍳 Processing order ${orderId} for student ${studentId}`);
    console.log(`📦 Item: ${itemId}, Quantity: ${quantity}`);

    // Simulate kitchen work: 3-7 seconds
    const cookingTime = Math.random() * 4000 + 3000; // 3000ms to 7000ms
    console.log(`⏰ Cooking time: ${Math.round(cookingTime / 1000)}s`);

    await new Promise((resolve) => setTimeout(resolve, cookingTime));

    console.log(`✅ Order ${orderId} ready!`);

    // Notify the Notification Hub
    try {
      await axios.post(`${config.notificationHubUrl}/notify`, {
        studentId,
        orderId,
        status: 'Ready',
      });
      console.log(`📢 Notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to notify for order ${orderId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: {
      host: config.redisUrl.includes('://') 
        ? new URL(config.redisUrl).hostname 
        : config.redisUrl.split(':')[0],
      port: config.redisUrl.includes('://') 
        ? parseInt(new URL(config.redisUrl).port || '6379') 
        : parseInt(config.redisUrl.split(':')[1] || '6379'),
    },
    concurrency: 3, // Process up to 3 orders concurrently
  }
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
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
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await worker.close();
  process.exit(0);
});
