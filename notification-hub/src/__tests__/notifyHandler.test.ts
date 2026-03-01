import { Request, Response } from 'express';
import { createNotifyHandler } from '../controllers/notifyController';
import { notificationsSentTotal } from '../metrics';

jest.mock('../metrics', () => ({
  notificationsSentTotal: {
    inc: jest.fn(),
  },
}));

describe('notifyController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let io: any;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    
    jest.clearAllMocks();

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return 400 if studentId, orderId, or status is missing', () => {
    const handler = createNotifyHandler(io);
    
    req.body = { studentId: '123' };
    handler(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    
    req.body = { studentId: '123', orderId: 'abc' };
    handler(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should emit to student room and return 200 on valid request', () => {
    const handler = createNotifyHandler(io);
    req.body = { studentId: 'student1', orderId: 'order1', status: 'Ready' };
    
    handler(req as Request, res as Response);
    
    expect(io.to).toHaveBeenCalledWith('student1');
    expect(io.emit).toHaveBeenCalledWith('orderStatusUpdate', {
      orderId: 'order1',
      status: 'Ready',
      timestamp: expect.any(String),
    });
    
    expect(notificationsSentTotal.inc).toHaveBeenCalledWith({ status: 'Ready' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Notification broadcasted' });
  });
});
