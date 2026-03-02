import { Request, Response, NextFunction } from 'express';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let serviceKilled = false;

export const setServiceKilled = (killed: boolean): void => {
  serviceKilled = killed;
};

export const getServiceKilled = (): boolean => serviceKilled;

export const createChaosMiddleware = (enabled: boolean) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (serviceKilled && !req.path.startsWith('/health') && !req.path.startsWith('/metrics') && !req.path.startsWith('/chaos')) {
      res.status(503).json({ error: 'Service temporarily unavailable (chaos kill switch active)' });
      return;
    }

    if (!enabled) {
      next();
      return;
    }

    // skip health and metrics endpoints
    if (req.path === '/health' || req.path === '/metrics') {
      next();
      return;
    }

    const random = Math.random();

    // 5% chance of instant 500 error
    if (random < 0.05) {
      console.error(`💥 CHAOS: Injecting 500 error for ${req.method} ${req.path}`);
      res.status(500).json({ error: 'Chaos Engineering: Simulated Service Failure' });
      return;
    }

    // 10% chance of 2-5s latency
    if (random < 0.15) {
      const delay = Math.floor(Math.random() * 3000) + 2000;
      console.warn(`⏳ CHAOS: Injecting ${delay}ms delay for ${req.method} ${req.path}`);
      await sleep(delay);
    }

    next();
  };
};
