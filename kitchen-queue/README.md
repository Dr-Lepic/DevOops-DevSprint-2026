# Kitchen Queue Worker

BullMQ worker that processes cooking orders from the queue.

## Features

- Listens to `cook_order` queue in Redis
- Simulates cooking time (3-7 seconds)
- Notifies the Notification Hub when order is ready
- Handles up to 3 concurrent orders

## Environment Variables

- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)
- `NOTIFICATION_HUB_URL`: Notification Hub URL (default: http://localhost:3003)
- `QUEUE_NAME`: Queue name to process (default: cook_order)
- `NODE_ENV`: Environment (default: development)

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```
