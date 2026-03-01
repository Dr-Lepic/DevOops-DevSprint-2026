import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  PORT: z.string().default('3002'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CHAOS_ENABLED: z.string().default('false').transform(val => val === 'true'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config = {
  databaseUrl: parsedEnv.data.DATABASE_URL,
  redisUrl: parsedEnv.data.REDIS_URL,
  port: parseInt(parsedEnv.data.PORT, 10),
  nodeEnv: parsedEnv.data.NODE_ENV,
  chaosEnabled: parsedEnv.data.CHAOS_ENABLED,
};
