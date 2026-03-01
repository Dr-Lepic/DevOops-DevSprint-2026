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

export const ordersPlacedTotal = new Counter({
  name: 'orders_placed_total',
  help: 'Total orders placed successfully',
  registers: [register],
});

export const stockCacheChecks = new Counter({
  name: 'stock_cache_checks_total',
  help: 'Total stock cache checks',
  labelNames: ['result'] as const, // 'hit' | 'miss' | 'depleted'
  registers: [register],
});

export const stockDeductionRetries = new Counter({
  name: 'stock_deduction_retries_total',
  help: 'Total retry attempts on stock deduction 409 conflicts',
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
