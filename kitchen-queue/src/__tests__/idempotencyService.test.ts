const store = new Map<string, string>();
const mockSet = jest.fn((key: string, value: string, mode?: string, ttl?: number, flag?: string) => {
  if (flag === 'NX' && store.has(key)) {
    return Promise.resolve(null);
  }
  store.set(key, value);
  return Promise.resolve('OK');
});
const mockGet = jest.fn((key: string) => Promise.resolve(store.get(key) || null));

const mockRedisInstance = {
  on: jest.fn(),
  get: mockGet,
  set: mockSet,
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

import { markProcessing, markCooked, markCompleted, getProcessingState } from '../services/idempotencyService';

describe('idempotencyService', () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('markProcessing should return true on fresh job and set NX', async () => {
    const result = await markProcessing('order1');
    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith('order:state:order1', 'cooking', 'EX', 3600, 'NX');
  });

  it('markProcessing should return false if job already exists', async () => {
    await markProcessing('order2');
    const result2 = await markProcessing('order2');
    expect(result2).toBe(false);
  });

  it('markCooked should update state', async () => {
    await markCooked('order3');
    expect(mockSet).toHaveBeenCalledWith('order:state:order3', 'cooked', 'EX', 3600);
    const state = await getProcessingState('order3');
    expect(state).toBe('cooked');
  });

  it('markCompleted should update state with 24h TTL', async () => {
    await markCompleted('order4');
    expect(mockSet).toHaveBeenCalledWith('order:state:order4', 'completed', 'EX', 86400);
    const state = await getProcessingState('order4');
    expect(state).toBe('completed');
  });

  it('getProcessingState should return typing correctly', async () => {
    expect(await getProcessingState('order5')).toBeNull();

    await markProcessing('order5');
    expect(await getProcessingState('order5')).toBe('cooking');
  });
});
