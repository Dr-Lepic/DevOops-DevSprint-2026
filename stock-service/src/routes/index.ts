import express from 'express';
import { deductStock } from '../controllers/stockController';

const router = express.Router();

router.post('/deduct', deductStock);

router.get('/health', async (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'stock-service' });
});

export default router;
