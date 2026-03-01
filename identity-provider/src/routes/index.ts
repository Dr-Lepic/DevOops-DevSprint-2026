import express from 'express';
import { login } from '../controllers/authController';
import { loginRateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

// Routes
router.post('/login', loginRateLimiter, login);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'identity-provider' });
});

export default router;
