import { Request, Response } from 'express';
import { login } from '../controllers/authController';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
}));

jest.mock('../config/env', () => ({
  config: {
    jwtSecret: 'secret',
  },
}));

describe('authController - login', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should return 400 if studentId or password missing', async () => {
    req.body = { studentId: '2100411' };
    await login(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'studentId and password are required' });
  });

  it('should return 401 on invalid credentials', async () => {
    req.body = { studentId: '2100411', password: 'wrong' };
    await login(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('should return 200 and token on valid credentials', async () => {
    req.body = { studentId: '2100411', password: 'password123' };
    await login(req as Request, res as Response);
    
    expect(jwt.sign).toHaveBeenCalledWith({ studentId: '2100411' }, 'secret', { expiresIn: '24h' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'mock-token',
      studentId: '2100411',
    });
  });
});
