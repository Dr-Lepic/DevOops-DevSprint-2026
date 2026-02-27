# Order Gateway Service

This service is the Day 2 gateway entrypoint for placing orders.

## Features

- JWT validation for protected order route
- Redis stock pre-check (`stock:{itemId}`)
- Stock service `POST /deduct` call with bounded retry on `409`
- BullMQ enqueue to `cook_order`

## Environment Variables

Copy `.env.example` to `.env`:

```env
JWT_SECRET=supersecret2026
REDIS_URL=redis://redis:6379
STOCK_SERVICE_URL=http://stock-service:3002
PORT=3000
NODE_ENV=development
QUEUE_NAME=cook_order
```

## Endpoints

- `POST /order` (requires `Authorization: Bearer <token>`)
- `GET /health`
