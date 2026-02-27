# DevSprint 2026 — Current Project Setup (Day 1)

This repository currently contains the **Day 1 implementation** of the cafeteria microservice plan:

- ✅ `identity-provider` (JWT login + Redis rate limit)
- ✅ `student-ui` (minimal `/login` page)
- ✅ PostgreSQL init schema with `version` column
- ✅ Root `docker-compose.yml`
- ⏳ `order-gateway`, `stock-service`, `kitchen-queue`, `notification-hub` are placeholders for upcoming days

---

## 1) Prerequisites

- Docker Desktop (with Docker Compose)
- Node.js 20+ (only needed for local non-Docker runs)

---

## 2) Run with Docker (Recommended)

From repository root:

```bash
docker compose up -d db redis identity-provider student-ui
```

Open:

- UI: http://localhost:3004/login
- Identity Health: http://localhost:3001/health

Stop services:

```bash
docker compose down
```

---

## 3) Manual Test Credentials

Use any mock user below:

- `2100411 / password123`
- `2100412 / password123`
- `2100413 / password123`
- `admin / admin123`

Expected login behavior:

- Success: `200` with `{ token, studentId }`
- Invalid credentials: `401`
- Rate limit exceeded (more than 3 attempts/min per key): `429`

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

Open: http://localhost:3004/login

> Note: For local runs, make sure Redis is running locally or switch to Docker for infra.

---

## 5) Current Service Ports

- `identity-provider`: `3001`
- `student-ui`: `3004`
- `redis`: `6379`
- `postgres`: `5432`
- placeholders: `order-gateway (3000)`, `stock-service (3002)`, `notification-hub (3003)`

---

## 6) Database Init (Day 1)

PostgreSQL initialization script is at:

- `db/init/001_init.sql`

It creates `items` with optimistic locking support:

- `id`, `name`, `quantity`, `version`

---

## 7) What’s Next

Planned next implementation milestone:

- Build real `order-gateway` and `stock-service`
- Wire `/order` -> `/deduct`
- Replace placeholder services in compose with real apps
