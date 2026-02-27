import express from 'express';
import { placeOrder } from '../controllers/orderController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/order', authMiddleware, placeOrder);

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'order-gateway' });
});

export default router;
