import { Request, Response } from 'express';
import { notificationsSentTotal } from '../metrics';

export const createNotifyHandler = (io: any) => {
  return (req: Request, res: Response): void => {
    try {
      const { studentId, orderId, status } = req.body;

      if (!studentId || !orderId || !status) {
        res.status(400).json({ error: 'studentId, orderId, and status are required' });
        return;
      }

      console.log(`📢 Broadcasting to student ${studentId}: Order ${orderId} is ${status}`);

      // Emit to the specific student's room
      io.to(studentId).emit('orderStatusUpdate', {
        orderId,
        status,
        timestamp: new Date().toISOString()
      });

      notificationsSentTotal.inc({ status });

      res.status(200).json({ message: 'Notification broadcasted' });
    } catch (error) {
      console.error('Notify route error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
