# DevSprint 2026 — IUT Cafeteria Microservice System

This repository contains the **Day 1 through Day 4 implementation** of a fault-tolerant, scalable cafeteria ordering system built over a 5-day hackathon.

### Services

| Service | Port | Status |
|---------|------|--------|
| `identity-provider` | 3001 | ✅ JWT login, rate limiting, `/health`, `/metrics` |
| `order-gateway` | 3000 | ✅ Auth, Redis pre-check, stock deduction, queue enqueue, `/health`, `/metrics` |
| `stock-service` | 3002 | ✅ Optimistic locking, cache sync, `/health`, `/metrics` |
| `kitchen-queue` | 3005 | ✅ BullMQ worker, idempotent two-phase processing, `/health`, `/metrics` |
| `notification-hub` | 3003 | ✅ Socket.io real-time push, `/health`, `/metrics` |
| `student-ui` | 3004 | ✅ Login, order, status, admin dashboard |
| `postgres` | 5432 | ✅ Items table with optimistic locking |
| `redis` | 6379 | ✅ Cache, queue broker, rate limiting, idempotency |

---

## 1) Prerequisites

- **Docker Desktop** (with Docker Compose v2)
- Node.js 20+ (only needed for local non-Docker development)

---

## 2) Quick Start (Docker)

```bash
# From repository root — boots all 8 containers
docker compose up --build -d
```

Wait ~30 seconds for all services to initialize, then open:

| Page | URL |
|------|-----|
| Login | http://localhost:3004/login |
| Place Order | http://localhost:3004/order |
| Live Status | http://localhost:3004/status |
| Admin Dashboard | http://localhost:3004/admin |

Stop everything:

```bash
docker compose down
```

To also wipe the database volume:

```bash
docker compose down -v
```

---

## 3) Manual Verification Guide

### Mock Users

| Student ID | Password |
|------------|----------|
| `2100411` | `password123` |
| `2100412` | `password123` |
| `2100413` | `password123` |
| `admin` | `admin123` |

### Test A — Login Flow

1. Open http://localhost:3004/login
2. Enter `2100411` / `password123`
3. On success, the app redirects to `/order` with a JWT stored locally

### Test B — Place an Order

1. On `/order`, use item `iftar-box-01`, quantity `1`
2. Expected: `201` response — "Stock secured, order in kitchen" with an `orderId`
3. Status transitions: `Pending` → `Stock Verified` → `In Kitchen`
4. **Check the response time** shown below the form — if under 1s, you'll see a subtle gray latency display

### Test C — Real-Time Status Update

1. Click "View Status" or go to http://localhost:3004/status
2. Your order appears with status progression including `Stock Verified` and `In Kitchen`
3. After 3-7 seconds (simulated cooking), the status auto-updates to "Ready" via Socket.io — no refresh needed

### Test D — Latency Warning (Visual Alert)

1. On `/order`, if the gateway takes longer than 1 second to respond, an **amber warning banner** appears:
   > ⚠ Gateway responded in Xms (>1s) — possible congestion
2. Under normal conditions you'll see a subtle "Response time: Xms" in gray

### Test E — Admin Dashboard

1. Go directly to http://localhost:3004/admin
2. You should see a grid of 5 service cards, each showing:
   - **Status badge**: Healthy (green), Degraded (amber), or Down (red)
   - **Uptime** in hours/minutes/seconds
   - **Dependency indicators** with colored dots (e.g., Redis: up, Postgres: up)
   - **Live Metrics**: average latency (ms) and throughput (/s)
3. The **kitchen-queue** card additionally shows queue stats: waiting / active / completed / failed
4. The **notification-hub** card shows the count of active socket connections
5. Use **Kill Gateway / Recover Gateway** button to simulate manual service kill and recovery
6. The dashboard auto-refreshes every 5 seconds. Click "Refresh Now" for an immediate poll
7. **Test degraded state**: stop a dependency (e.g., `docker stop redis`) and watch services report degraded/unreachable behavior. Restart with `docker start redis`

### Test F — Health Endpoints (curl)

```bash
# All services
curl http://localhost:3001/health   # identity-provider
curl http://localhost:3000/health   # order-gateway
curl http://localhost:3002/health   # stock-service
curl http://localhost:3005/health   # kitchen-queue (includes queue stats)
curl http://localhost:3003/health   # notification-hub (includes socket count)
```

When dependencies are healthy, endpoint returns `200` with JSON like:

```json
{
  "status": "healthy",
  "service": "order-gateway",
  "uptime": 123.456,
  "dependencies": {
    "redis": "up",
    "stockService": "up"
  }
}
```

When dependencies are down, dependent services return `503 Service Unavailable` with `status: "degraded"`.

### Test G — Prometheus Metrics Endpoints

```bash
curl http://localhost:3001/metrics   # identity-provider
curl http://localhost:3000/metrics   # order-gateway
curl http://localhost:3002/metrics   # stock-service
curl http://localhost:3005/metrics   # kitchen-queue
curl http://localhost:3003/metrics   # notification-hub
```

Returns Prometheus text format with default Node.js runtime metrics plus custom counters/histograms per service.

### Test H — Idempotency (Kitchen Worker)

1. Place an order normally — it processes and notifies as expected
2. To verify idempotency, stop the notification-hub mid-processing:
   ```bash
   docker stop notification-hub
   ```
3. Place an order — the kitchen worker will cook it but fail on notification, moving the job to a retry state
4. Check Redis for the idempotency key:
   ```bash
   docker exec redis redis-cli GET "order:state:<orderId>"
   # Should return "cooked" (cooking done, notification pending)
   ```
5. Restart notification-hub:
   ```bash
   docker start notification-hub
   ```
6. BullMQ retries the job — this time it **skips cooking** (already cooked) and only retries the notification
7. The Redis key updates to "completed"

### Test I — Idempotency (Stock Deduction Replay Safety)

1. Place an order from `/order` (the UI sends an `Idempotency-Key` header)
2. Retry the same request with the same `Idempotency-Key`
3. Expected: stock-service returns the cached success payload and does **not** double-decrement stock

### Expected Error Responses

| Scenario | Status | Response |
|----------|--------|----------|
| Missing/invalid JWT | `401` | `{ "error": "..." }` |
| Zero stock in cache | `400` | `{ "error": "Out of Stock" }` |
| Insufficient stock in DB | `400` | `{ "error": "Insufficient stock" }` |
| Optimistic lock conflict | `409` | `{ "error": "Conflict during deduction, please retry" }` |
| Rate limit exceeded (login) | `429` | `{ "error": "Too many login attempts..." }` |

---

## 4) Local Development (Without Docker)

You'll need Redis and PostgreSQL running locally (or via Docker for infra only).

### Infrastructure only:

```bash
docker compose up -d redis db
```

### Then run each service:

```bash
# Identity Provider
cd identity-provider && npm install && npm run dev
# Needs: JWT_SECRET=supersecret2026 REDIS_URL=redis://localhost:6379 PORT=3001

# Order Gateway
cd order-gateway && npm install && npm run dev
# Needs: JWT_SECRET=supersecret2026 REDIS_URL=redis://localhost:6379 STOCK_SERVICE_URL=http://localhost:3002 PORT=3000 QUEUE_NAME=cook_order

# Stock Service
cd stock-service && npm install && npm run dev
# Needs: DATABASE_URL=postgres://user:pass@localhost:5432/cafeteria REDIS_URL=redis://localhost:6379 PORT=3002

# Kitchen Queue
cd kitchen-queue && npm install && npm run dev
# Needs: REDIS_URL=redis://localhost:6379 NOTIFICATION_HUB_URL=http://localhost:3003 QUEUE_NAME=cook_order PORT=3005

# Notification Hub
cd notification-hub && npm install && npm run dev
# Needs: PORT=3003 CORS_ORIGIN=http://localhost:3004

# Student UI
cd student-ui && npm install && npm run dev
# Uses: NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000 NEXT_PUBLIC_IDENTITY_URL=http://localhost:3001 NEXT_PUBLIC_HUB_URL=http://localhost:3003
```

---

## 5) Automated Tests

A system test script validates the full end-to-end flow:

```bash
# With Docker services running:
npm run test
```

Covers: health checks, login, JWT auth, order flow, cache pre-check, queue enqueue, kitchen processing, and notification broadcast.

---

## 6) Architecture

```
Student Browser
    │
    ├── POST /login ──────────► Identity Provider (3001)
    │                              └── Redis (rate limiting)
    │
    ├── POST /order ──────────► Order Gateway (3000)
    │                              ├── Redis (cache pre-check)
    │                              ├── Stock Service (3002)
    │                              │     ├── PostgreSQL (optimistic locking)
    │                              │     └── Redis (cache sync)
    │                              └── BullMQ Queue (Redis)
    │                                    │
    │                                    ▼
    │                              Kitchen Worker (3005)
    │                                    ├── Redis (idempotency keys)
    │                                    └── POST /notify
    │                                          │
    │                                          ▼
    └── Socket.io ◄───────────── Notification Hub (3003)
```

### Technology Stack

- **Backend**: Node.js 20 + Express + TypeScript
- **Database**: PostgreSQL 16 (optimistic locking with `version` column)
- **Cache/Queue**: Redis 7 (caching, BullMQ, rate limiting, idempotency)
- **Real-time**: Socket.io
- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Observability**: Prometheus metrics via `prom-client`
- **Containerization**: Docker + Docker Compose (single `docker compose up`)

---

## 7) Database Schema

```sql
CREATE TABLE items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  version INT NOT NULL DEFAULT 0
);
```

Seeded with `iftar-box-01` (qty 50) and `iftar-box-02` (qty 50).

---

## 8) What's Next (Day 5)

- CI/CD pipeline with GitHub Actions
- Unit tests for stock deduction and queue processing
- Full `docker compose up --build` deploy to AWS EC2
- Chaos engineering toggle for resilience testing
