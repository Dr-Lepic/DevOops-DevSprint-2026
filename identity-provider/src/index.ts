import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import routes from './routes';
import { redisClient } from './middlewares/rateLimiter';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Identity Provider running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Redis URL: ${config.redisUrl}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});
