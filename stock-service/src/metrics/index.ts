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

export const stockDeductionsTotal = new Counter({
  name: 'stock_deductions_total',
  help: 'Total stock deduction attempts',
  labelNames: ['result'] as const, // 'success' | 'conflict' | 'insufficient'
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const currentStockQuantity = new Gauge({
  name: 'current_stock_quantity',
  help: 'Current stock quantity per item',
  labelNames: ['item_id'] as const,
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
