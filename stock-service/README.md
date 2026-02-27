# Stock Service

This service is the Day 2 stock source of truth.

## Features

- `POST /deduct` endpoint
- Optimistic locking with `version` column
- Returns `409` conflict when concurrent update loses race
- Updates Redis cache key `stock:{itemId}` on successful deduction

## Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgres://user:pass@db:5432/cafeteria
REDIS_URL=redis://redis:6379
PORT=3002
NODE_ENV=development
```
