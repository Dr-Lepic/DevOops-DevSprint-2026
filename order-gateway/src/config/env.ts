import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  STOCK_SERVICE_URL: z.string().url('STOCK_SERVICE_URL must be a valid URL'),
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  QUEUE_NAME: z.string().default('cook_order'),
  CHAOS_ENABLED: z.string().default('false').transform(val => val === 'true'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config = {
  jwtSecret: parsedEnv.data.JWT_SECRET,
  redisUrl: parsedEnv.data.REDIS_URL,
  stockServiceUrl: parsedEnv.data.STOCK_SERVICE_URL,
  port: parseInt(parsedEnv.data.PORT, 10),
  nodeEnv: parsedEnv.data.NODE_ENV,
  queueName: parsedEnv.data.QUEUE_NAME,
  chaosEnabled: parsedEnv.data.CHAOS_ENABLED,
};
