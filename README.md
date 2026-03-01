# DevSprint 2026 — Current Project Setup (Day 3)

This repository currently contains **Day 1 + Day 2 + Day 3 implementation** of the cafeteria microservice plan.

- ✅ `identity-provider` (JWT login)
- ✅ `order-gateway` (`POST /order`, JWT auth, Redis pre-check, stock call, queue enqueue)
- ✅ `stock-service` (`POST /deduct`, optimistic locking, Redis cache sync)
- ✅ `kitchen-queue` (BullMQ worker, processes orders, sends notifications)
- ✅ `notification-hub` (Socket.io server, real-time order status updates)
- ✅ `student-ui` (`/login`, `/order`, and `/status` pages with real-time updates)
- ✅ PostgreSQL init schema with `version` column
- ✅ Root `docker-compose.yml` wired for Day 3

---

## 1) Prerequisites

- Docker Desktop (with Docker Compose)
- Node.js 20+ (only needed for local non-Docker runs)

---

## 2) Run with Docker (Recommended)

From repository root:

```bash
docker compose up -d
```

Open:

- Student UI Login: http://localhost:3004/login
- Student UI Order: http://localhost:3004/order
- Student UI Status: http://localhost:3004/status
- Identity Health: http://localhost:3001/health
- Notification Hub Health: http://localhost:3003/health

Stop services:

```bash
docker compose down
```

---

## 3) Day 3 Manual Test Flow (Complete End-to-End)

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
- Order status will show "In Kitchen" immediately

### Step C — Real-time order tracking

- Click "View Status" link or navigate to `/status`
- See live order updates via Socket.io
- After 3-7 seconds (simulated cooking time), order status updates to "Ready" automatically
- No page refresh needed - updates appear in real-time

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

### Kitchen Queue Worker

```bash
cd kitchen-queue
npm install
# create .env from .env.example
npm run dev
```

Required env values:

```env
REDIS_URL=redis://localhost:6379
NOTIFICATION_HUB_URL=http://localhost:3003
QUEUE_NAME=cook_order
NODE_ENV=development
```

### Notification Hub

```bash
cd notification-hub
npm install
# create .env from .env.example
npm run dev
```

Required env values:

```env
PORT=3003
NODE_ENV=development
CORS_ORIGIN=http://localhost:3004
```

Open: http://localhost:3004/login

> Note: For local runs, make sure Redis is running locally or switch to Docker for infra.

---

## 5) Current Service Ports

- `identity-provider`: `3001`
- `order-gateway`: `3000`
- `stock-service`: `3002`
- `notification-hub`: `3003`
- `student-ui`: `3004`
- `redis`: `6379`
- `postgres`: `5432`
- `kitchen-queue`: (no external port, internal worker)

---

## 6) Database Init

PostgreSQL initialization script is at:

- `db/init/001_init.sql`

It creates `items` with optimistic locking support:

- `id`, `name`, `quantity`, `version`

---

## 7) Day 3 Implementation Complete ✅

### Kitchen Queue Worker (`kitchen-queue/`)
- ✅ BullMQ worker listening to `cook_order` queue
- ✅ Simulates cooking time (3-7 seconds randomly)
- ✅ Processes up to 3 orders concurrently
- ✅ Sends notification to Notification Hub when ready

### Notification Hub (`notification-hub/`)
- ✅ Socket.io server on port 3003
- ✅ REST endpoint `/notify` for kitchen worker
- ✅ Room-based notifications (students join their room)
- ✅ CORS configured for frontend

### Student UI Updates
- ✅ Socket.io client integration (`src/lib/socket.ts`)
- ✅ Updated `/order` page to connect socket and show real-time status
- ✅ Created `/status` page for live order tracking
- ✅ Added link to view status from order page

---

## 8) Automated Test Files (Day 1 + Day 2 + Day 3)

A root-level system test script is included:

- `tests/system.test.mjs`

It validates:

- Service health checks (`identity-provider`, `order-gateway`, `stock-service`, `notification-hub`)
- Day 1 login success
- Day 2 JWT protection on `/order`
- Day 2 successful order flow
- Day 2 cache pre-check block when Redis has `stock:{itemId} = 0`
- Day 3 BullMQ queue enqueue
- Day 3 kitchen worker processing
- Day 3 notification hub broadcasting

Run it from repo root (with Docker services running):

```bash
npm run test
```

If needed, override service URLs:

```bash
IDENTITY_URL=http://localhost:3001 GATEWAY_URL=http://localhost:3000 STOCK_URL=http://localhost:3002 npm run test:day1-day2
```

---

## 9) Architecture Overview

### Microservices Flow

1. **Student** logs in via `/login` → **Identity Provider** issues JWT
2. **Student** places order via `/order` → **Order Gateway** validates JWT
3. **Order Gateway** checks Redis cache for stock availability
4. **Order Gateway** calls **Stock Service** to deduct inventory (with optimistic locking)
5. **Stock Service** updates PostgreSQL and syncs Redis cache
6. **Order Gateway** enqueues job to **Kitchen Queue** (BullMQ/Redis)
7. **Kitchen Worker** picks up job, simulates cooking (3-7s)
8. **Kitchen Worker** notifies **Notification Hub** when ready
9. **Notification Hub** broadcasts via Socket.io to **Student UI**
10. **Student** sees real-time status update on `/status` page

### Technology Stack

- **Backend**: Node.js 20 + Express + TypeScript
- **Database**: PostgreSQL 16 (optimistic locking with version column)
- **Cache/Queue**: Redis 7 (caching + BullMQ)
- **Real-time**: Socket.io
- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Containerization**: Docker + Docker Compose

---

## 10) What's Next (Day 4+)

Future enhancements could include:

- Admin dashboard for monitoring all orders (`/admin`)
- Prometheus metrics and Grafana dashboards for observability
- Health check endpoints with detailed service status
- Chaos engineering toggle for testing resilience
- CI/CD pipeline with GitHub Actions
- Unit tests for critical services (stock deduction, queue processing)
- Rate limiting restore (currently disabled for testing)
- Order history and persistence
