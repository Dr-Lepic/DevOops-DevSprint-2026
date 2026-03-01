import client, { Registry, Counter, Histogram } from 'prom-client';
import { Request, Response } from 'express';

// Create a dedicated registry
export const register = new Registry();

// Add default Node.js metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ register });

// Custom metrics
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

export const loginAttemptsTotal = new Counter({
  name: 'login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['result'] as const, // 'success' | 'failure'
  registers: [register],
});

export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit hits',
  registers: [register],
});

// Metrics endpoint handler
export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
};
