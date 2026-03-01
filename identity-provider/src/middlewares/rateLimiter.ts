import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/env';

// Create Redis client
const redisClient = createClient({
  url: config.redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis: Too many reconnection attempts');
        return new Error('Too many reconnection attempts');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected for rate limiter');
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Create rate limiter middleware
export const loginRateLimiter = rateLimit({
  // Use Redis as the store
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  
  // Rate limit: 3 requests per 1 minute (60,000 ms)
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Limit each key to 3 requests per window
  
  // Custom key generator: use studentId from body if available, otherwise use IP
  keyGenerator: (req) => {
    const studentId = req.body?.studentId;
    if (studentId) {
      return `login:student:${studentId}`;
    }
    // Fallback to IP address
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `login:ip:${ip}`;
  },
  
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    const studentId = req.body?.studentId;
    const identifier = studentId ? `Student ID: ${studentId}` : `IP: ${req.ip}`;
    console.log(`⚠️  Rate limit exceeded for ${identifier}`);
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      retryAfter: '60 seconds',
    });
  },
  
  // Don't count successful requests against the limit
  skipSuccessfulRequests: false,
  
  // Don't count failed requests against the limit
  skipFailedRequests: false,
  
  // Return standard rate limit headers
  standardHeaders: true,
  legacyHeaders: false,
});

// Export Redis client for graceful shutdown
export { redisClient };
