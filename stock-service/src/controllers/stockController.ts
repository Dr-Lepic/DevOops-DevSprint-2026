import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { redisClient } from '../cache/redis';

const IDEMPOTENCY_TTL_SECONDS = 10 * 60;

type IdempotencyRecord = {
  itemId: string;
  quantity: number;
  response: {
    message: string;
    remaining: number;
  };
};

export const deductStock = async (req: Request, res: Response): Promise<void> => {
  const { itemId, quantity } = req.body as { itemId?: string; quantity?: number };
  const idempotencyHeader =
    (typeof req.header === 'function' && (req.header('Idempotency-Key') || req.header('idempotency-key'))) ||
    req.headers?.['idempotency-key'] ||
    req.headers?.['Idempotency-Key'];
  const idempotencyKey = typeof idempotencyHeader === 'string' ? idempotencyHeader : undefined;

  if (!itemId || !quantity) {
    res.status(400).json({ error: 'itemId and quantity are required' });
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    res.status(400).json({ error: 'quantity must be a positive integer' });
    return;
  }

  const redisIdempotencyKey = idempotencyKey
    ? `idempotency:stock-deduct:${idempotencyKey}`
    : null;

  if (redisIdempotencyKey) {
    try {
      const existing = await redisClient.get(redisIdempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing) as IdempotencyRecord;

        if (parsed.itemId !== itemId || parsed.quantity !== quantity) {
          res.status(409).json({ error: 'Idempotency key already used with different payload' });
          return;
        }

        res.status(200).json(parsed.response);
        return;
      }
    } catch (error) {
      console.error('Idempotency read failed:', error);
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query<{
      quantity: number;
      version: number;
    }>('SELECT quantity, version FROM items WHERE id = $1', [itemId]);

    if (currentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const currentItem = currentResult.rows[0];

    if (currentItem.quantity < quantity) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    const updateResult = await client.query<{ quantity: number }>(
      `UPDATE items
       SET quantity = quantity - $2, version = version + 1
       WHERE id = $1 AND version = $3
       RETURNING quantity`,
      [itemId, quantity, currentItem.version]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Conflict during deduction, please retry' });
      return;
    }

    const remaining = updateResult.rows[0].quantity;

    await client.query('COMMIT');

    redisClient
      .set(`stock:${itemId}`, remaining.toString())
      .catch((error) => console.error('Failed to sync Redis cache:', error));

    if (redisIdempotencyKey) {
      const record: IdempotencyRecord = {
        itemId,
        quantity,
        response: {
          message: 'Stock deducted successfully',
          remaining,
        },
      };

      redisClient
        .set(redisIdempotencyKey, JSON.stringify(record), { EX: IDEMPOTENCY_TTL_SECONDS })
        .catch((error) => console.error('Failed to write idempotency record:', error));
    }

    res.status(200).json({
      message: 'Stock deducted successfully',
      remaining,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deduction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
