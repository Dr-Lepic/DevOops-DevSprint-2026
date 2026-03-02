import { createNotifyHandler } from './controllers/notifyController';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/env';
import { httpRequestsTotal, httpRequestDuration, notificationsSentTotal, socketConnectionsActive, metricsHandler } from './metrics';
import { chaosKillMiddleware, getServiceKilled, setServiceKilled } from './middlewares/chaosMiddleware';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(chaosKillMiddleware);
app.use(chaosKillMiddleware);

// Metrics middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode.toString() });
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode.toString() }, durationSec);
  });
  next();
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Handle joinRoom event - client joins their studentId room
  socket.on('joinRoom', (studentId: string) => {
    if (!studentId) {
      console.error('❌ joinRoom called without studentId');
      return;
    }
    socket.join(studentId);
    console.log(`✓ Student ${studentId} joined their room`);
    socketConnectionsActive.set(io.engine.clientsCount);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    socketConnectionsActive.set(io.engine.clientsCount);
  });
});

// REST API endpoint for Kitchen Worker to notify
app.post('/notify', createNotifyHandler(io));

// Prometheus metrics endpoint
app.get('/metrics', metricsHandler);

// Chaos engineering endpoints
app.get('/chaos/state', (req, res) => {
  res.json({
    killed: getServiceKilled(),
    service: 'notification-hub',
  });
});

app.post('/chaos/kill', (req, res) => {
  setServiceKilled(true);
  console.warn('🔴 CHAOS: Service kill switch activated');
  res.json({ status: 'killed', message: 'Service will now return 503 for all requests (except health/metrics/chaos)' });
});

app.post('/chaos/recover', (req, res) => {
  setServiceKilled(false);
  console.log('✅ CHAOS: Service kill switch deactivated');
  res.json({ status: 'recovered', message: 'Service is now operational' });
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const isKilled = getServiceKilled();
  const overallStatus = isKilled ? 'down' : 'healthy';
  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({ 
    status: overallStatus, 
    service: 'notification-hub',
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
httpServer.listen(config.port, () => {
  console.log('🚀 Notification Hub running on port', config.port);
  console.log('📝 Environment:', config.nodeEnv);
  console.log('🔗 CORS Origin:', config.corsOrigin);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
