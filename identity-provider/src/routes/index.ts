import express from 'express';
import { login } from '../controllers/authController';

const router = express.Router();

// Routes
router.post('/login', login);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'identity-provider' });
});

export default router;
