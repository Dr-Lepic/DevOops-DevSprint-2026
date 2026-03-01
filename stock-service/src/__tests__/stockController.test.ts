import { Request, Response } from 'express';

jest.mock('../config/env', () => ({
  config: {
    databaseUrl: 'postgres://mock',
    redisUrl: 'redis://mock',
    port: 3002,
    nodeEnv: 'test',
    chaosEnabled: false,
  },
}));

import { deductStock } from '../controllers/stockController';
import { pool } from '../db/pool';
import { redisClient } from '../cache/redis';

jest.mock('../db/pool', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../cache/redis', () => ({
  redisClient: {
    set: jest.fn().mockResolvedValue('OK'),
  },
}));

describe('stockController - deductStock', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let mockClient: any;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  it('should return 400 if itemId or quantity is missing', async () => {
    req.body = { itemId: 'item-1' };
    await deductStock(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'itemId and quantity are required' });
  });

  it('should return 400 if quantity is not a positive integer', async () => {
    req.body = { itemId: 'item-1', quantity: 0 };
    await deductStock(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    
    req.body = { itemId: 'item-1', quantity: 1.5 };
    await deductStock(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 404 if item not found', async () => {
    req.body = { itemId: 'item-1', quantity: 1 };
    
    await deductStock(req as Request, res as Response);

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should return 400 if insufficient stock', async () => {
    req.body = { itemId: 'item-1', quantity: 5 };
    mockClient.query.mockImplementation((queryText: string) => {
      if (queryText.startsWith('SELECT')) return Promise.resolve({ rowCount: 1, rows: [{ quantity: 2, version: 1 }] });
      return Promise.resolve({ rowCount: 0, rows: [] });
    });

    await deductStock(req as Request, res as Response);

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient stock' });
  });

  it('should return 409 on optimistic lock conflict', async () => {
    req.body = { itemId: 'item-1', quantity: 2 };
    mockClient.query.mockImplementation((queryText: string) => {
      if (queryText.startsWith('SELECT')) return Promise.resolve({ rowCount: 1, rows: [{ quantity: 10, version: 1 }] });
      if (queryText.startsWith('UPDATE')) return Promise.resolve({ rowCount: 0, rows: [] });
      return Promise.resolve({ rowCount: 0, rows: [] });
    });

    await deductStock(req as Request, res as Response);

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Conflict during deduction, please retry' });
  });

  it('should return 200 on successful deduction and sync cache', async () => {
    req.body = { itemId: 'item-1', quantity: 2 };
    mockClient.query.mockImplementation((queryText: string) => {
      if (queryText.startsWith('SELECT')) return Promise.resolve({ rowCount: 1, rows: [{ quantity: 10, version: 1 }] });
      if (queryText.startsWith('UPDATE')) return Promise.resolve({ rowCount: 1, rows: [{ quantity: 8 }] });
      return Promise.resolve({ rowCount: 0, rows: [] });
    });

    await deductStock(req as Request, res as Response);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(redisClient.set).toHaveBeenCalledWith('stock:item-1', '8');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Stock deducted successfully', remaining: 8 });
    expect(mockClient.release).toHaveBeenCalled();
  });
});
