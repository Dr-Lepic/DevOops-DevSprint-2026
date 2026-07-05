# DevSprint 2026 — IUT Cafeteria Microservice System (🏆Champion Submission)

A distributed, containerized cafeteria ordering platform designed for high-traffic bursts with authentication, stock safety, async kitchen processing, realtime notifications, and admin observability.

---

## 1) Service Summary

### Core Services

| Service | URL | What It Does |
|---|---|---|
| Identity Provider | http://localhost:3001 | Authenticates users and issues JWT tokens; enforces login rate limiting. |
| Order Gateway | http://localhost:3000 | Main API entrypoint; validates JWT, checks stock cache, coordinates stock deduction and queueing. |
| Stock Service | http://localhost:3002 | Source of truth for inventory; performs concurrency-safe stock deduction with optimistic locking. |
| Kitchen Queue | http://localhost:3005 | Processes queued orders asynchronously (3–7s simulation), with idempotent retry-safe handling. |
| Notification Hub | http://localhost:3003 | Pushes realtime order status updates to clients via Socket.io. |
| Student UI | http://localhost:3004 | Frontend for student ordering/status and admin monitoring dashboard. |

### Infrastructure

| Service | URL | What It Does |
|---|---|---|
| PostgreSQL | localhost:5432 | Persistent transactional store for inventory (`items` table). |
| Redis | localhost:6379 | Cache, queue broker (BullMQ), rate-limit store, and idempotency state store. |

### Main UI Routes

| Route | URL | Purpose |
|---|---|---|
| Student Login | http://localhost:3004/login | Student authentication and token acquisition. |
| Place Order | http://localhost:3004/order | Authenticated order submission and immediate acknowledgment. |
| Live Status | http://localhost:3004/status | Realtime order progression tracking. |
| Admin Dashboard | http://localhost:3004/admin | Password-gated operational monitoring and chaos controls. |

---

## 2) Architecture (High-Level)

```text
Browser
  ├─ /login  ──> Identity Provider (JWT + rate limit)
  └─ /order  ──> Order Gateway
                 ├─ Redis stock pre-check
                 ├─ Stock Service (Postgres optimistic locking + Redis sync)
                 └─ BullMQ enqueue to Kitchen Queue

Kitchen Queue
  └─ /notify ──> Notification Hub (Socket.io broadcast)

Browser
  └─ Socket.io <── Notification Hub (orderStatusUpdate)
```

---

## 2.1) Requirements Compliance (Submission Checklist)

| Requirement Area | Required | Implemented |
|---|---|---|
| Single-command startup | Run full system with one command | ✅ `docker compose up --build -d` starts the full stack |
| Token handshake | Client must login to get secure token | ✅ `POST /login` in Identity Provider returns JWT |
| Protected routes | Gateway must reject missing/invalid bearer token | ✅ Gateway auth middleware returns `401` |
| Idempotency (partial failures) | Prevent duplicate effects on retries | ✅ Gateway forwards `Idempotency-Key`; Stock Service replays prior success for duplicate key; Kitchen Queue uses idempotent state machine |
| Asynchronous processing | Fast ack + decoupled execution | ✅ Gateway enqueues BullMQ job and returns immediately; Kitchen worker processes async (3–7s) |
| Cache-first stock check | Reject on cached zero stock before DB hit | ✅ Gateway checks Redis `stock:{itemId}` before stock-service call |
| Stock concurrency safety | Prevent overselling under concurrent load | ✅ Stock Service uses PostgreSQL optimistic locking with `version` column |
| Unit tests | Validate order/stock logic | ✅ Unit test suites exist across services; root `npm run test:unit` |
| Automated pipeline | Run tests on push | ✅ GitHub Actions pipeline in `.github/workflows/ci.yml` |
| Health endpoints | 200 healthy, 503 dependency down | ✅ Dependency-aware `/health` implemented with proper status codes |
| Metrics endpoints | Machine-readable throughput/latency/error metrics | ✅ `/metrics` on all backend services (Prometheus format) |
| Student UI journey | Login → order → live status flow | ✅ `/login`, `/order`, `/status` with realtime Socket.io updates |
| Status progression | `Pending → Stock Verified → In Kitchen → Ready` | ✅ Implemented in order/status UI flow |
| Admin health grid | Green/Red (and degraded) service state visibility | ✅ `/admin` health cards with dependency indicators |
| Admin live metrics | Realtime latency + throughput | ✅ Dashboard computes and displays per-service metrics from `/metrics` |
| Chaos toggle | Manual service kill trigger from UI | ✅ Admin kill/recover controls for gateway |

### Bonus Coverage Snapshot

- ✅ **Rate limiting**: Identity Provider limits login attempts (3/minute).
- ✅ **Visual latency alert**: Order page warns when gateway response exceeds 1s.


### Quick Evidence Commands

```bash
# 1) System up
docker compose up --build -d

# 2) Health and status codes
curl -i http://localhost:3000/health

# 3) Metrics endpoint
curl http://localhost:3000/metrics

# 4) Automated tests
npm run test
npm run test:unit
```

---

## 3) Service Details 

### Identity Provider
- **Tech**: Node.js, Express, TypeScript, `jsonwebtoken`, Redis, `express-rate-limit`.
- **How it works**:
  - `POST /login` validates credentials and returns `{ token, studentId }`.
  - Login attempts are limited (3/minute per student/IP).
  - Exposes `/health` and `/metrics`.

### Order Gateway
- **Tech**: Node.js, Express, TypeScript, Axios, Redis, BullMQ.
- **How it works**:
  - Auth middleware rejects missing/invalid bearer tokens with `401`.
  - Checks Redis cache key `stock:{itemId}` before calling stock service.
  - Calls stock service deduct endpoint with an `Idempotency-Key`.
  - On success, enqueues kitchen job and returns fast acknowledgment (`201`).
  - Exposes `/health`, `/metrics`, and chaos kill/recover controls.

### Stock Service
- **Tech**: Node.js, Express, TypeScript, PostgreSQL, Redis.
- **How it works**:
  - Performs stock deduction in a DB transaction.
  - Uses optimistic locking (`version` column) to prevent race corruption.
  - Returns `409` on conflict and `400` on insufficient stock.
  - Replays successful deduction response for duplicate idempotency key to prevent double-decrement on retry.
  - Syncs updated stock to Redis cache.

### Kitchen Queue
- **Tech**: Node.js, TypeScript, BullMQ, Redis, Axios, Express (health/metrics server).
- **How it works**:
  - Worker consumes `cook_order` jobs.
  - Simulates prep delay (3–7s), then notifies Notification Hub.
  - Uses two-phase idempotent state (`cooking` → `cooked` → `completed`) in Redis.
  - Safe on retries: avoids duplicate cooking/notification actions.

### Notification Hub
- **Tech**: Node.js, Express, TypeScript, Socket.io.
- **How it works**:
  - Clients join room by `studentId`.
  - Kitchen calls `POST /notify`.
  - Server emits `orderStatusUpdate` to the correct room.
  - Exposes `/health` and `/metrics`.

### Student UI (includes Admin)
- **Tech**: Next.js App Router, React, Tailwind CSS, Axios, Socket.io client.
- **How it works**:
  - Student journey: login → place order → realtime status updates.
  - Status flow: `Pending → Stock Verified → In Kitchen → Ready`.
  - Admin page (`/admin`) is standalone and password-gated (no student pre-login required).
  - Admin dashboard shows:
    - Health grid (healthy/degraded/down)
    - Live metrics (latency, throughput)
    - Queue and socket stats
    - Chaos kill/recover toggle for gateway

---

## 4) Observability and Health Behavior

- Every backend service exposes `/metrics` (Prometheus format).
- Dependency-aware health endpoints return:
  - `200` when healthy
  - `503` when dependencies are down/degraded

Quick checks:

```bash
curl http://localhost:3001/health
curl http://localhost:3000/health
curl http://localhost:3002/health
curl http://localhost:3005/health
curl http://localhost:3003/health
```

---

## 5) Run with Docker (Recommended)

### Prerequisites
- Docker Desktop (Compose v2)

### Start all services

```bash
docker compose up --build -d
```

### Stop all services

```bash
docker compose down
```

### Stop + remove volumes (fresh reset)

```bash
docker compose down -v
```

---

## 6) Auto-Heal Container Watcher (Recommended)

Use this watcher to keep your Docker Compose stack self-healing during demos and evaluation.

It continuously watches compose services and if any service is missing/down, it automatically runs:

```bash
docker compose up -d <service>
```

### Why this is important
- Test service stops and auto restarts.
- Recovers only affected services (does not recreate everything).
- Works with the current `docker-compose.yml` project setup.

### Recommended usage flow

1. Start full stack:

```bash
docker compose up --build -d
```

2. Start watcher in a separate terminal and keep it running:

```bash
npm run watch:containers
```

3. Optional quick check (single cycle):

```bash
npm run watch:containers:once
```

### Optional tuning
- `CONTAINER_WATCH_INTERVAL_MS` (default: `5000`)
- `CONTAINER_RESTART_COOLDOWN_MS` (default: `15000`)
- `CONTAINER_RESTART_UNHEALTHY` (default: `false`)

Example with custom interval and unhealthy recovery:

```bash
CONTAINER_WATCH_INTERVAL_MS=2000 CONTAINER_RESTART_UNHEALTHY=true npm run watch:containers
```

### Troubleshooting
- If `watch:containers` exits, run `watch:containers:once` to inspect behavior quickly.
- Ensure Docker Desktop is running and `docker compose ps` works in the repo root.
- Keep watcher in its own terminal session; stopping that terminal stops the watcher.

---

## 7) Local Development (Without Full Docker)

Bring up infra only:

```bash
docker compose up -d redis db
```

Then run services individually:

```bash
# identity-provider
cd identity-provider && npm install && npm run dev

# order-gateway
cd order-gateway && npm install && npm run dev

# stock-service
cd stock-service && npm install && npm run dev

# kitchen-queue
cd kitchen-queue && npm install && npm run dev

# notification-hub
cd notification-hub && npm install && npm run dev

# student-ui
cd student-ui && npm install && npm run dev
```

---

## 8) Testing

### Full system test

```bash
npm run test
```

### Unit tests across services

```bash
npm run test:unit
```

---

## 9) Database Schema

```sql
CREATE TABLE items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  version INT NOT NULL DEFAULT 0
);
```

Seed examples are included in `db/init/001_init.sql`.
