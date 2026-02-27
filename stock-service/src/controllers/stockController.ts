import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { redisClient } from '../cache/redis';

export const deductStock = async (req: Request, res: Response): Promise<void> => {
  const { itemId, quantity } = req.body as { itemId?: string; quantity?: number };

  if (!itemId || !quantity) {
    res.status(400).json({ error: 'itemId and quantity are required' });
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    res.status(400).json({ error: 'quantity must be a positive integer' });
    return;
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
