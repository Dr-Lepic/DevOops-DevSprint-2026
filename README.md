# DevSprint 2026 — Current Project Setup (Day 2)

This repository currently contains **Day 1 + Day 2 implementation** of the cafeteria microservice plan.

- ✅ `identity-provider` (JWT login + Redis rate limit)
- ✅ `order-gateway` (`POST /order`, JWT auth, Redis pre-check, stock call, queue enqueue)
- ✅ `stock-service` (`POST /deduct`, optimistic locking, Redis cache sync)
- ✅ `student-ui` (`/login` and `/order` pages)
- ✅ PostgreSQL init schema with `version` column
- ✅ Root `docker-compose.yml` wired for Day 2
- ⏳ `kitchen-queue` worker logic and `notification-hub` logic are pending (Day 3)

---

## 1) Prerequisites

- Docker Desktop (with Docker Compose)
- Node.js 20+ (only needed for local non-Docker runs)

---

## 2) Run with Docker (Recommended)

From repository root:

```bash
docker compose up -d db redis identity-provider stock-service order-gateway student-ui
```

Open:

- UI: http://localhost:3004/login
- Identity Health: http://localhost:3001/health

Stop services:

```bash
docker compose down
```

---

## 3) Day 2 Manual Test Flow

Use any mock user below:

- `2100411 / password123`
- `2100412 / password123`
- `2100413 / password123`
- `admin / admin123`

### Step A — Login

- Open `http://localhost:3004/login`
- Login with a mock credential
- App redirects to `/order`

### Step B — Place order

- On `/order`, use item `iftar-box-01`, quantity `1`
- Expected success: `201` with `Stock secured, order in kitchen` and `orderId`

Gateway now uses a strict spec-aligned pre-check policy:
- If Redis has `stock:{itemId}` and value is `<= 0`, gateway returns `400 Out of Stock`
- If Redis key is missing, gateway proceeds to stock-service (fail-open on cache miss)

### Expected failures

- Missing/invalid token: `401`
- Zero stock in cache (`stock:{itemId} <= 0`): `400 Out of Stock`
- Optimistic lock conflict from stock-service: gateway retries briefly, then returns `409` if still conflicting

---

## 4) Local Run (Without Docker)

### Identity Provider

```bash
cd identity-provider
npm install
# create .env from .env.example
npm run dev
```

Required env values:

```env
JWT_SECRET=supersecret2026
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
```

### Student UI

```bash
cd student-ui
npm install
npm run dev
```

### Order Gateway

```bash
cd order-gateway
npm install
# create .env from .env.example
npm run dev
```

### Stock Service

```bash
cd stock-service
npm install
# create .env from .env.example
npm run dev
```

Open: http://localhost:3004/login

> Note: For local runs, make sure Redis is running locally or switch to Docker for infra.

---

## 5) Current Service Ports

- `identity-provider`: `3001`
- `order-gateway`: `3000`
- `stock-service`: `3002`
- `student-ui`: `3004`
- `redis`: `6379`
- `postgres`: `5432`
- placeholder logic still pending: `kitchen-queue`, `notification-hub (3003)`

---

## 6) Database Init

PostgreSQL initialization script is at:

- `db/init/001_init.sql`

It creates `items` with optimistic locking support:

- `id`, `name`, `quantity`, `version`

---

## 7) What’s Next (Day 3)

Planned next implementation milestone:

- Implement kitchen queue worker processing
- Implement notification hub socket flow + `/notify`
- Connect UI live status updates (`/status`)
