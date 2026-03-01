import Redis from 'ioredis';
import { config } from '../config/env';

const redis = new Redis(config.redisUrl);

redis.on('error', (err) => {
  console.error('Idempotency Redis error:', err);
});

export type OrderState = 'cooking' | 'cooked' | 'completed' | null;

const KEY_PREFIX = 'order:state:';
const PROCESSING_TTL = 3600;   // 1 hour for in-progress states
const COMPLETED_TTL = 86400;   // 24 hours for completed orders

/**
 * Mark an order as "cooking". Uses NX to prevent concurrent duplicates.
 * Returns true if successfully set (fresh job), false if key already exists.
 */
export const markProcessing = async (orderId: string): Promise<boolean> => {
  const result = await redis.set(`${KEY_PREFIX}${orderId}`, 'cooking', 'EX', PROCESSING_TTL, 'NX');
  return result === 'OK';
};

/**
 * Mark an order as "cooked" (cooking done, notification pending).
 */
export const markCooked = async (orderId: string): Promise<void> => {
  await redis.set(`${KEY_PREFIX}${orderId}`, 'cooked', 'EX', PROCESSING_TTL);
};

/**
 * Mark an order as "completed" (fully done, notification sent).
 */
export const markCompleted = async (orderId: string): Promise<void> => {
  await redis.set(`${KEY_PREFIX}${orderId}`, 'completed', 'EX', COMPLETED_TTL);
};

/**
 * Get the current processing state of an order.
 */
export const getProcessingState = async (orderId: string): Promise<OrderState> => {
  const value = await redis.get(`${KEY_PREFIX}${orderId}`);
  if (value === 'cooking' || value === 'cooked' || value === 'completed') {
    return value;
  }
  return null;
};

/**
 * Close the Redis connection (for graceful shutdown).
 */
export const closeIdempotencyRedis = async (): Promise<void> => {
  await redis.quit();
};
