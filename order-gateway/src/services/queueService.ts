import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';

const redisUrl = new URL(config.redisUrl);

const queue = new Queue(config.queueName, {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || '6379', 10),
  },
});

export const enqueueOrder = async (payload: {
  studentId: string;
  itemId: string;
  quantity: number;
}): Promise<string> => {
  const orderId = uuidv4();

  await queue.add('cook_order', {
    ...payload,
    orderId,
  });

  return orderId;
};
