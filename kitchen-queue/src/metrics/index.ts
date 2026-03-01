import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response } from 'express';

export const register = new Registry();

client.collectDefaultMetrics({ register });

export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total jobs processed by the kitchen worker',
  labelNames: ['result'] as const, // 'success' | 'failure'
  registers: [register],
});

export const jobProcessingDuration = new Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Job processing duration in seconds (including cooking simulation)',
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 10],
  registers: [register],
});

export const jobsActive = new Gauge({
  name: 'jobs_active',
  help: 'Number of currently active (processing) jobs',
  registers: [register],
});

export const jobsWaiting = new Gauge({
  name: 'jobs_waiting',
  help: 'Number of jobs waiting in queue',
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
