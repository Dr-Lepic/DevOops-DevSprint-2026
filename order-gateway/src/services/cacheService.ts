import { createClient } from 'redis';
import { config } from '../config/env';

const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (error) => {
  console.error('Redis Client Error:', error);
});

redisClient.connect().catch((error) => {
  console.error('Failed to connect to Redis:', error);
});

export const getCachedStock = async (itemId: string): Promise<number | null> => {
  const value = await redisClient.get(`stock:${itemId}`);

  if (value === null) {
    return null;
  }

  const parsedValue = parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return parsedValue;
};
