import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response } from 'express';

export const register = new Registry();

client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications broadcast via Socket.io',
  labelNames: ['status'] as const,
  registers: [register],
});

export const socketConnectionsActive = new Gauge({
  name: 'socket_connections_active',
  help: 'Number of active Socket.io connections',
  registers: [register],
});

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
};
