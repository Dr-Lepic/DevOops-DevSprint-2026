import { Request, Response } from 'express';

jest.mock('../config/env', () => ({
  config: {
    jwtSecret: 'secret',
    redisUrl: 'redis://localhost',
    stockServiceUrl: 'http://localhost',
    queueName: 'cook_order'
  }
}));

import { placeOrder } from '../controllers/orderController';
import { getCachedStock } from '../services/cacheService';
import { enqueueOrder } from '../services/queueService';
import axios from 'axios';

jest.mock('../services/cacheService');
jest.mock('../services/queueService');
jest.mock('axios');

describe('orderController - placeOrder', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {}, user: { studentId: '123' } } as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should return 400 if itemId or quantity is missing/invalid', async () => {
    req.body = { itemId: 'item-1' };
    await placeOrder(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);

    req.body = { itemId: 'item-1', quantity: -1 };
    await placeOrder(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 if cached stock is <= 0', async () => {
    req.body = { itemId: 'item-1', quantity: 1 };
    (getCachedStock as jest.Mock).mockResolvedValue(0);

    await placeOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Out of Stock' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should return stock service error if deduct fails without retryable conflict', async () => {
    req.body = { itemId: 'item-1', quantity: 1 };
    (getCachedStock as jest.Mock).mockResolvedValue(10);
    
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: 'Insufficient stock' }
      }
    });
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

    await placeOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient stock' });
  });

  it('should enqueue and return 201 on success', async () => {
    req.body = { itemId: 'item-1', quantity: 1 };
    (getCachedStock as jest.Mock).mockResolvedValue(10);
    
    (axios.post as jest.Mock).mockResolvedValue({
      data: { message: 'Success', remaining: 9 }
    });

    (enqueueOrder as jest.Mock).mockResolvedValue('order-xyz');

    await placeOrder(req as Request, res as Response);

    expect(enqueueOrder).toHaveBeenCalledWith({
      studentId: '123',
      itemId: 'item-1',
      quantity: 1,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Stock secured, order in kitchen',
      orderId: 'order-xyz',
    });
  });
});
