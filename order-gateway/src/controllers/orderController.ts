import axios from 'axios';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { getCachedStock } from '../services/cacheService';
import { enqueueOrder } from '../services/queueService';

type DeductResponse = {
  message: string;
  remaining: number;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const deductStockWithRetry = async (
  itemId: string,
  quantity: number,
  idempotencyKey: string,
  maxRetries = 2
): Promise<DeductResponse> => {
  let attempt = 0;

  while (true) {
    try {
      const response = await axios.post<DeductResponse>(
        `${config.stockServiceUrl}/deduct`,
        { itemId, quantity },
        {
          timeout: 1500,
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409 && attempt < maxRetries) {
        attempt += 1;
        await sleep(100 * attempt);
        continue;
      }

      throw error;
    }
  }
};

export const placeOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, quantity } = req.body as { itemId?: string; quantity?: number };

    if (!itemId || !quantity) {
      res.status(400).json({ error: 'itemId and quantity are required' });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'quantity must be a positive integer' });
      return;
    }

    const cachedStock = await getCachedStock(itemId);

    if (cachedStock !== null && cachedStock <= 0) {
      res.status(400).json({ error: 'Out of Stock' });
      return;
    }

    const idempotencyKeyHeader =
      (typeof req.header === 'function' && req.header('Idempotency-Key')) ||
      req.headers?.['idempotency-key'] ||
      req.headers?.['Idempotency-Key'];

    const idempotencyKey =
      (typeof idempotencyKeyHeader === 'string' ? idempotencyKeyHeader : undefined) || randomUUID();
    await deductStockWithRetry(itemId, quantity, idempotencyKey);

    const studentId = req.user?.studentId;

    if (!studentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = await enqueueOrder({
      studentId,
      itemId,
      quantity,
    });

    res.status(201).json({
      message: 'Stock secured, order in kitchen',
      orderId,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json(error.response.data);
      return;
    }

    console.error('Order placement failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
