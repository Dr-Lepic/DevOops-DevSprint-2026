import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

// Mock user database for testing
const mockUsers = [
  { studentId: '2100411', password: 'password123' },
  { studentId: '2100412', password: 'password123' },
  { studentId: '2100413', password: 'password123' },
  { studentId: 'admin', password: 'admin123' },
];

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, password } = req.body;

    // Validation
    if (!studentId || !password) {
      res.status(400).json({ error: 'studentId and password are required' });
      return;
    }

    // Mock DB Check
    const user = mockUsers.find(
      (u) => u.studentId === studentId && u.password === password
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Sign JWT
    const token = jwt.sign(
      { studentId: user.studentId },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Response
    res.status(200).json({
      token,
      studentId: user.studentId,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
