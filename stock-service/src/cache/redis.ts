import { createClient } from 'redis';
import { config } from '../config/env';

export const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (error) => {
  console.error('Redis Client Error:', error);
});

redisClient.connect().catch((error) => {
  console.error('Failed to connect to Redis:', error);
});
