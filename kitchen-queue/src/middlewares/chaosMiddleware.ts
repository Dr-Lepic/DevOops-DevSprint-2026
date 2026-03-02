import { Request, Response, NextFunction } from 'express';

let serviceKilled = false;

export const setServiceKilled = (killed: boolean): void => {
  serviceKilled = killed;
};

export const getServiceKilled = (): boolean => serviceKilled;

export const chaosKillMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (serviceKilled && !req.path.startsWith('/health') && !req.path.startsWith('/metrics') && !req.path.startsWith('/chaos')) {
    res.status(503).json({ error: 'Service temporarily unavailable (chaos kill switch active)' });
    return;
  }
  next();
};
