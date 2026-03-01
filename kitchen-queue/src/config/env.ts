import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  notificationHubUrl: process.env.NOTIFICATION_HUB_URL || 'http://localhost:3003',
  queueName: process.env.QUEUE_NAME || 'cook_order',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3005', 10),
  chaosEnabled: process.env.CHAOS_ENABLED === 'true',
};
