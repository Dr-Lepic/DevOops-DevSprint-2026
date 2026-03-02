# DevSprint 2026: IUT Cafeteria Project Master Plan

This document outlines the detailed master plan designed to guide an AI Agent in building a fault-tolerant, scalable microservice system over a 5-day hackathon. 

## 0. Implementation Status Snapshot (Updated: 2026-02-28)

This section records actual implementation progress so team members can quickly see what is done vs planned.

### ✅ Gap Closure Update (2026-03-02)
- Health endpoint semantics aligned to requirement for dependency-aware services:
  - `identity-provider`, `order-gateway`, `stock-service`, `kitchen-queue` now return `503` when dependencies are down.
- Stock-deduction idempotency (partial failure safety) implemented:
  - `order-gateway` forwards `Idempotency-Key` to `stock-service`.
  - `stock-service` caches successful deduction result by idempotency key in Redis and replays response on duplicates.
- Student journey status flow now explicitly includes `Stock Verified`:
  - `/order` and `/status` UI updated to show `Pending → Stock Verified → In Kitchen → Ready`.
- Admin dashboard enhanced with required live metrics:
  - Per-service average latency and throughput derived from `/metrics` and rendered in service cards.
- Manual chaos kill toggle added:
  - Admin dashboard button toggles `order-gateway` kill/recover through runtime chaos control endpoints.

### ✅ Completed (Day 1 + Day 2 + Day 3 Scope)
- Identity Provider implemented in `identity-provider/`:
  - `POST /login` with payload validation
  - JWT issuance (`{ token, studentId }`)
  - Redis-backed rate limit: 3 attempts per minute (IP or `studentId`)
  - `GET /health`
- Student UI login implemented in `student-ui/`:
  - Next.js App Router setup
  - `/login` page calls Identity Provider and stores token locally
- Day 2 backend services implemented:
  - `order-gateway/` with JWT auth middleware and `POST /order`
  - Redis pre-check on `stock:{itemId}` (fail-open on cache miss, fail-closed on cached `<= 0`)
  - Retry-with-backoff on stock-service `409` conflicts
  - BullMQ enqueue on successful stock deduction
  - `stock-service/` with `POST /deduct` optimistic locking
  - Redis cache sync after successful deduction
- Student UI order flow implemented:
  - `/order` page calls gateway using Bearer token
  - login redirects to `/order`
- Database initialization implemented:
  - `db/init/001_init.sql` creates `items(id, name, quantity, version)`
  - seed rows for test stock
- Root Docker Compose implemented:
  - Infrastructure + network wiring in `docker-compose.yml`
  - All services (`order-gateway`, `stock-service`, `kitchen-queue`, `notification-hub`) fully implemented
- Day 3 real-time services implemented:
  - `kitchen-queue/` BullMQ worker processing orders
  - Simulates cooking time (3-7 seconds randomly)
  - Processes up to 3 orders concurrently
  - Sends notifications to notification hub when ready
  - `notification-hub/` Socket.io server on port 3003
  - REST endpoint `/notify` for kitchen worker
  - Room-based notifications (students join their room)
  - CORS configured for frontend
- Student UI real-time updates implemented:
  - Socket.io client integration (`src/lib/socket.ts`)
  - `/order` page connects to socket and shows real-time status
  - `/status` page for live order tracking
  - Link to view status from order page

### ✅ Verification Completed
- `identity-provider`: TypeScript build succeeded
- `student-ui`: install + production build succeeded (with socket.io-client)
- `order-gateway`: install + TypeScript build succeeded
- `stock-service`: install + TypeScript build succeeded
- `kitchen-queue`: install + TypeScript build succeeded
- `notification-hub`: install + TypeScript build succeeded
- Docker image builds succeeded for all services
- Runtime smoke checks passed:
  - `GET /health` returns healthy response for all services
  - valid `POST /login` returns token
  - valid `POST /order` returns `201` with orderId
  - BullMQ enqueues jobs successfully
  - Kitchen worker processes jobs (3-7s simulation)
  - Notification hub broadcasts via Socket.io
  - Real-time status updates visible on `/status` page

### ⏳ Pending (Expected for Day 5+)
- None! All core hackathon tasks are complete.

### ✅ Completed (Day 5 Scope)
- Installed `jest` and `ts-jest` for automated unit testing.
- Written 30+ passing unit tests covering all 5 core APIs and functions: `orderController`, `stockController`, `idempotencyService`, `authController`, `notifyController`.
- Hardened `docker-compose.yml` with proper inline health-checks for Redis and Postgres databases, leveraging `depends_on: { condition: service_healthy }` to orchestrate booting safely.
- Implemented `chaosMiddleware.ts` for chaos engineering: injecting random 500 errors (5%) and latency spikes up to 5s (10%) on API calls. Added chaos task failures to BullMQ worker queue.
- Generated `.github/workflows/ci.yml` pipeline that correctly tests standard Node endpoints and executes Docker build checks before system-level testing.
- Composed a comprehensive `guide.md` specifying external setup tasks for GitHub, AWS EC2 `t3.micro` launch configuration, DNS/IP assignment, and live Chaos testing instructions.

### ✅ Completed (Day 4 Scope)
- Prometheus `/metrics` endpoints added to all 5 backend services using `prom-client`:
  - Default Node.js metrics (CPU, memory, event loop, GC) on every service
  - `identity-provider`: `http_requests_total`, `http_request_duration_seconds`, `login_attempts_total`, `rate_limit_hits_total`
  - `order-gateway`: `http_requests_total`, `http_request_duration_seconds`, `orders_placed_total`, `stock_cache_checks_total`, `stock_deduction_retries_total`
  - `stock-service`: `http_requests_total`, `http_request_duration_seconds`, `stock_deductions_total`, `db_query_duration_seconds`, `current_stock_quantity`
  - `kitchen-queue`: `jobs_processed_total`, `job_processing_duration_seconds`, `jobs_active`, `jobs_waiting`
  - `notification-hub`: `http_requests_total`, `http_request_duration_seconds`, `notifications_sent_total`, `socket_connections_active`
- Enhanced `/health` endpoints with dependency checks:
  - `identity-provider`: checks Redis connectivity
  - `order-gateway`: checks Redis + stock-service `/health`
  - `stock-service`: checks Postgres (`SELECT 1`) + Redis
  - `kitchen-queue`: checks Redis + BullMQ queue stats (waiting/active/completed/failed)
  - `notification-hub`: reports uptime + active socket connections
  - All return `status: 'healthy'` or `status: 'degraded'` based on dependency state
- Kitchen-queue now exposes Express HTTP server on port 3005 (for `/health` + `/metrics`)
- Kitchen Worker idempotency with two-phase state machine:
  - Redis-based state tracking (`order:state:{orderId}`) with TTL
  - Phase 1 (Cook): `null` → `cooking` → `cooked`
  - Phase 2 (Notify): `cooked` → `completed`
  - On retry: skips cooking if already `cooked`, skips entirely if `completed`
  - Prevents duplicate cooking simulations and duplicate notifications
- Queue producer now sets `jobId = orderId` for BullMQ deduplication at enqueue time
- Admin Dashboard (`/admin` page) with live health grid:
  - Polls all 5 backend `/health` endpoints every 5 seconds
  - Responsive grid (1/2/3 columns) with status badges (Healthy/Degraded/Down)
  - Dependency status indicators with colored dots
  - Kitchen-queue card shows queue stats (waiting/active/completed/failed)
  - Notification-hub card shows active socket connections
  - Uptime display per service, overall status bar, manual refresh button
- Visual Alert on Order Page:
  - Measures gateway response latency with `Date.now()` around the `POST /order` call
  - Amber warning banner when response exceeds 1 second: "Gateway responded in Xms (>1s)"
  - Normal response time shown in subtle gray text when under 1s
- Navigation: Admin link added to order page header

## 1. System Architecture & Tech Stack

The system is designed for a Free Tier deployment (e.g., a single AWS EC2 t3.micro instance) and leverages the following stack:
- **Backend**: Node.js (Express) + TypeScript.
- **Database**: PostgreSQL (Docker container) for transactional inventory control.
- **Cache & Queue Broker**: Redis (Docker container).
- **Real-Time Sync**: Socket.io (Node.js).
- **Frontend**: Next.js (App Router) + Tailwind CSS + Axios.
- **Deployment**: Local Docker Compose bringing up the entire network (`identity-provider`, `order-gateway`, `stock-service`, `kitchen-queue`, `notification-hub`, `db`, `redis`, `frontend`).

---

## 2. Microservice Specifications, API Contracts, & Logic Flows

This section breaks down the *exact* logical flow, network connections, and code-level expectations for each service so an AI agent can implement them unambiguously.

### Service 1: Identity Provider (Port 3001)
* **Goal**: Issue JWTs and apply rate limiting (Bonus Requirement).
* **Dependencies**: Redis (for Rate Limiting).
* **Environment Variables**: `JWT_SECRET=supersecret2026`, `REDIS_URL=redis://redis:6379`.
* **Endpoints & Flow**: 
  - `POST /login`:
    1. **Rate Limiting**: Use `express-rate-limit` connected to Redis. Limit: 3 requests per 1 minute window per IP or `studentId` body param.
    2. **Validation**: Check payload `{ studentId, password }`.
    3. **Mock DB Check**: Hardcode a mock user array. If valid, sign a JWT using `JWT_SECRET` containing `{ studentId }`.
    4. **Response**: Return `200 OK` with `{ token: "jwt_string", studentId: "..." }`.
    - **Example Request**:
      ```json
      { "studentId": "2100411", "password": "password123" }
      ```
    - **Example Response (200 OK)**:
      ```json
      { "token": "eyJhbGciOi...", "studentId": "2100411" }
      ```

### Service 2: Order Gateway (Port 3000 - Entrypoint)
* **Goal**: The sole entrypoint for the UI. Validates tokens, checks cache, and coordinates upstream services.
* **Dependencies**: Redis (Cache), Identity Provider (for secret sync), Stock Service (HTTP), Kitchen Queue (Redis BullMQ).
* **Environment Variables**: `JWT_SECRET=supersecret2026`, `REDIS_URL=redis://redis:6379`, `STOCK_SERVICE_URL=http://stock-service:3002`.
* **Endpoints & Detailed Flow**:
  - `POST /order` (Payload: `{ studentId: string, itemId: string, quantity: number }`):
    - **Step 1 (Auth Middleware)**: Extract Bearer token from headers. Verify using `jsonwebtoken` and `JWT_SECRET`. Reject `401` if invalid.
    - **Step 2 (Cache Pre-Check)**: Connect to Redis. Read key `stock:{itemId}`. 
      - If value is `<= 0`, return `400 Bad Request` instantly (Stock Depleted). *Do not hit the DB.*
    - **Step 3 (Synchronous Stock Deduction)**: Make an Axios `POST` call to `STOCK_SERVICE_URL/deduct` with the original payload.
      - If Stock Service returns `409` (Conflict due to Optimistic Lock) or `400`, return that error to the user.
    - **Step 4 (Asynchronous Kitchen Drop)**: If Stock Service returns `200 OK`, instantiate a BullMQ Queue targeting `redis`. Add the job: `queue.add('cook_order', { studentId, itemId, quantity, orderId: uuid() })`.
    - **Step 5 (Acknowledgment)**: Return `201 Accepted` with `{ message: "Stock secured, order in kitchen", orderId }`. (This raw flow must execute in < 2 seconds).
    - **Example Request**:
      - **Headers**: `Authorization: Bearer eyJhbGciOi...`
      - **Body**:
        ```json
        { "studentId": "2100411", "itemId": "iftar-box-01", "quantity": 1 }
        ```
    - **Example Response (201 Accepted)**:
      ```json
      { "message": "Stock secured, order in kitchen", "orderId": "abc-123-xyz" }
      ```
    - **Example Response (400 Bad Request - Cache 0)**:
      ```json
      { "error": "Out of Stock" }
      ```

### Service 3: Stock Service (Port 3002)
* **Goal**: The absolute source of truth for inventory. Handles concurrent bursts safely.
* **Dependencies**: PostgreSQL, Redis.
* **Environment Variables**: `DATABASE_URL=postgres://user:pass@db:5432/cafeteria`, `REDIS_URL=redis://redis:6379`.
* **Database Schema**: Table `items (id VARCHAR PK, name VARCHAR, quantity INT, version INT)`.
* **Endpoints & Detailed Flow**:
  - `POST /deduct` (Payload: `{ itemId: string, quantity: number }`):
    1. **Fetch**: `SELECT quantity, version FROM items WHERE id = $1`.
    2. **Validate**: If `quantity < requested_qty`, return `400 Bad Request`.
    3. **Optimistic Locking Update**: 
       ```sql
       UPDATE items 
       SET quantity = quantity - $2, version = version + 1 
       WHERE id = $1 AND version = $3
       ```
    4. **Race Condition Check**: If the `row_count` returned by the update is `0`, another transaction modified the row first. Return `409 Conflict` (The Gateway can theoretically retry, but returning 409 is acceptable for the hackathon).
    5. **Cache Sync**: If successful, fire a background Redis command to update the cache: `SET stock:{itemId} {new_quantity}`.
    6. **Response**: Return `200 OK`.
    - **Example Request (Internal from Gateway)**:
      ```json
      { "itemId": "iftar-box-01", "quantity": 1 }
      ```
    - **Example Response (200 OK)**:
      ```json
      { "message": "Stock deducted successfully", "remaining": 49 }
      ```
    - **Example Response (409 Conflict)**:
      ```json
      { "error": "Conflict during deduction, please retry" }
      ```

### Service 4: Kitchen Queue Worker (No Exposed Port)
* **Goal**: Decouple intensive processing to keep the Gateway fast.
* **Dependencies**: Redis (BullMQ Worker), Notification Hub (HTTP).
* **Environment Variables**: `REDIS_URL=redis://redis:6379`, `NOTIFICATION_HUB_URL=http://notification-hub:3003`.
* **Core Logic Flow**:
  1. Boot up a BullMQ `Worker` listening to the `'cook_order'` queue on Redis.
  2. On job processing (`async (job) => { ... }`):
     - Extract `studentId` and `orderId` from `job.data`.
     - **Simulate Work**: `await new Promise(res => setTimeout(res, Math.random() * 4000 + 3000))` (Wait 3-7s).
     - **Notify Status**: Make an Axios `POST` call to `NOTIFICATION_HUB_URL/notify` with payload `{ studentId, orderId, status: "Ready" }`.
  3. **Fault Tolerance / Idempotency**: If the Node process crashes *during* the `setTimeout`, BullMQ keeps the job as "active" or moves it to "failed", allowing you to configure retries upon restart.

### Service 5: Notification Hub (Port 3003)
* **Goal**: Real-time push updates to the UI, eliminating client polling.
* **Dependencies**: None.
* **Endpoints & Flow**:
  - `Socket.io Server`: 
    - On client connection, expect the client to emit a `joinRoom` event passing their `studentId`.
    - `socket.join(studentId)`.
  - `POST /notify` (Payload: `{ studentId, orderId, status }`):
    - This is an internal REST endpoint hit by the Kitchen Queue.
    - Logic: `io.to(studentId).emit("orderStatusUpdate", { orderId, status })`.
    - Return `200 OK` to the Kitchen Worker.
    - **Example Request (Internal from Worker)**:
      ```json
      { "studentId": "2100411", "orderId": "abc-123-xyz", "status": "Ready" }
      ```
    - **Example Response (200 OK)**:
      ```json
      { "message": "Notification broadcasted" }
      ```

### Service 6: Next.js Frontend (Port 3004)
* **Goal**: Student ordering flow and Admin Monitoring.
* **Dependencies**: Order Gateway, Identity Provider, Notification Hub.
* **Environment Variables**: `NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000`, `NEXT_PUBLIC_IDENTITY_URL=http://localhost:3001`, `NEXT_PUBLIC_HUB_URL=http://localhost:3003`.
* **Workflow**:
  1. **Login**: User enters ID. Frontend calls Identity Provider. Saves JWT to React State/Context.
  2. **Socket Connect**: Frontend connects `socket.io-client` to Notification Hub and emits `joinRoom(studentId)`.
  3. **Order Placement**: User clicks "Order". Frontend sets local state to `status: Pending`. Calls Gateway `POST /order` with JWT in Header.
  4. **Gateway Response**: Receives `201 Accepted`. Frontend updates state to `status: In Kitchen`.
  5. **Socket Event**: Frontend listens for `orderStatusUpdate`. When received, updates state to `status: Ready`.

---

## 3. Team Member Assignments (3 Members)

### Member 1: API & Security Lead
* **Scope**: Identity Provider, Order Gateway.
* **Tasks**: Setup JWT, Redis Cache check, Rate Limiting, and the central routing logic linking the gateway to the stock service and queue.

### Member 2: Data & Async Engineering Lead
* **Scope**: Stock Service, Postgres, Kitchen Queue Worker.
* **Tasks**: Write the Optimistic Locking SQL queries, CI/CD unit tests for stock deduction, set up the BullMQ worker, and handle Redis retries on failure. Also manages the `docker-compose.yml`.

### Member 3: Frontend, Real-Time & Observability Lead
* **Scope**: Notification Hub, Next.js UI, Prometheus/Grafana integration.
* **Tasks**: Build the Socket.io server, wire it to the Student UI, build the Admin dashboard's health grid, and configure Docker to scrape `/metrics`.

---

## 4. 5-Day Milestone Timeline

### Day 1: Auth, DB & Scaffolding
- Setup repo and the `docker-compose.yml` defining networks for postgres, redis, and empty node containers.
- Impl Identity Provider `/login` and Next.js `/login` UI.
- Setup PostgreSQL schema with the `version` column.

#### Day 1 Actual Status: ✅ Completed
- Implemented in repository:
  - `identity-provider/`
  - `student-ui/`
  - `db/init/001_init.sql`
  - root `docker-compose.yml`
- All Day 1 deliverables are present and runnable for manual testing.

### Day 2: Core Routing & Stock Protection
- Impl Order Gateway token verification and Redis Pre-check.
- Impl Stock Service `POST /deduct` with Optimistic Locking.
- Next.js: Complete `/order` UI flow.

#### Day 2 Actual Status: ✅ Completed
- Implemented in repository:
  - `order-gateway/`
  - `stock-service/`
  - `student-ui/src/app/order/page.jsx`
  - updated `docker-compose.yml` for real Day 2 services
- End-to-end path verified: login -> gateway order -> stock deduction -> queue enqueue.

### Day 3: Queues & Sockets
- Route successful Gateway orders into the Redis Queue.
- Impl Kitchen Queue Worker (reads queue, waits 3-7s).
- Impl Notification Hub Socket Server; connect Kitchen Worker to hit Hub's `/notify` when done.
- Next.js: Connect Socket client to listen for "Ready".

#### Day 3 Actual Status: ✅ Completed
- Implemented in repository:
  - `kitchen-queue/` with BullMQ worker, TypeScript, Docker build
  - `notification-hub/` with Socket.io server, `/notify` endpoint, TypeScript, Docker build
  - `student-ui/src/lib/socket.ts` Socket.io client integration
  - `student-ui/src/app/status/page.jsx` real-time order tracking page
  - Updated `/order` page with socket connection and live status
  - Updated `docker-compose.yml` with real Day 3 service configurations
- End-to-end path verified: login → order → stock deduction → queue → kitchen processing (3-7s) → notification broadcast → UI real-time update
- All 8 services running successfully in Docker

### Day 4: Observability & Resilience
- Add `/health` and Prometheus `/metrics` endpoints to all node services.
- Handle Idempotency logic in Kitchen Worker (job retries).
- Next.js: Build Admin Dashboard Health Grid.
- Impl Visual Alert bonus (Warning on UI if Gateway latency >1s).

### Day 5: Deployment & CI/CD
- Write Unit tests for Stock Service deduction; configure GitHub Actions.
- Ensure `docker compose up --build` brings up 8 containers perfectly hooked up.
- Deploy to AWS EC2 Free Tier. Test Chaos Toggle.

---

## 5. Containerization & Network Architecture (Docker)

To meet the hackathon requirement of a single `docker compose up` command, every service must be containerized efficiently.

### Generic Node.js Dockerfile (For Services 1-5)
The backend services share a highly similar build process. The agent should use this multi-stage template:

```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# Example for Gateway (Change per service)
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Next.js Frontend Dockerfile (Service 6)
Next.js requires a slightly different build for standalone production runs:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Standalone output reduces image size significantly
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3004
CMD ["node", "server.js"]
```

### The Master `docker-compose.yml`
The agent must generate a root docker-compose file that orchestrates the entire network. Key requirements for the compose file:
1. **Networks**: Define a custom bridge network (e.g., `cafeteria_net`) so services can discover each other via container names (e.g., `http://stock-service:3002`).
2. **Depends On**:
   - `order-gateway` must depend on `redis` and `identity-provider`.
   - `stock-service` must depend on `postgres`.
   - `kitchen-queue` must depend on `redis`.
3. **Environment Injection**: The compose file must inject the environment variables specified in Section 2, ensuring URL endpoints point to other container names, NOT `localhost` (Except the Next.js frontend, where `NEXT_PUBLIC` vars accessed by the user's browser must point to `localhost:PORT`).
4. **Volume Mounts**: Ensure PostgreSQL data is mounted to a local named volume so inventory state persists across container restarts.

---

## 6. Project & Folder Structure

To ensure consistency, the AI Agent must follow this precise folder structure when generating the services.

### Root Directory Structure
The root `devsprint-2026/` folder will contain the global docker-compose and subfolders for each service:
```text
devsprint-2026/
├── docker-compose.yml       # Master file to boot all services
├── README.md                # Project documentation
├── identity-provider/       # Service 1
├── order-gateway/           # Service 2
├── stock-service/           # Service 3
├── kitchen-queue/           # Service 4
├── notification-hub/        # Service 5
└── student-ui/              # Service 6 (Next.js)
```

### Microservice Folder Structure (Services 1-5 Node.js/Express)
Each of the 5 backend services should follow an identical modular architecture.
*(Example shown for `order-gateway/`)*
```text
order-gateway/
├── Dockerfile               # Node.js Multi-stage build
├── package.json             
├── tsconfig.json            # TypeScript configuration
├── src/
│   ├── index.ts             # Entry point (Express Setup & App Listen)
│   ├── config/
│   │   └── env.ts           # Centralized environment variable parsing using Zod/Joi
│   ├── controllers/
│   │   └── orderController.ts # HTTP Request handlers (Step-by-step logic)
│   ├── middlewares/
│   │   └── authMiddleware.ts # JWT Validation logic
│   ├── routes/
│   │   └── index.ts         # Express route definitions
│   ├── services/
│   │   ├── cacheService.ts  # Redis interaction (e.g. check stock:{itemId})
│   │   └── queueService.ts  # BullMQ interaction
│   └── utils/
│       └── logger.ts        # Optional: Winston/Pino logger
```

### Frontend Folder Structure (Service 6 Next.js App Router)
```text
student-ui/
├── Dockerfile               # Next.js Standalone build
├── package.json
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── next.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Global layout & Next.js providers
│   │   ├── page.tsx         # Redirects to /login
│   │   ├── login/
│   │   │   └── page.jsx     # Login Form Component
│   │   ├── order/
│   │   │   └── page.jsx     # Order Iftar button
│   │   ├── status/
│   │   │   └── page.jsx     # Live Status UI (SocketClient)
│   │   └── admin/
│   │       └── page.jsx     # Monitoring Dashboard (Health Grid)
│   ├── components/
│   │   ├── ui/              # Reusable Tailwind components (Buttons, Cards)
│   │   └── statusBadge.tsx
│   ├── lib/
│   │   ├── axios.ts         # Axios interceptors for adding JWT
│   │   └── socket.ts        # socket.io-client initialization
│   └── store/
│       └── authStore.ts     # Zustand/Context for generic React State
```

---

## 7. How to Instruct the AI Agent

Copy and paste specific specifications from Section 2, Section 5, and Section 6 into your prompts.

**Example Next Steps using this document**:
- *"Agent, look at Service 1 in the Implementation Plan. Initialize the Identity Provider Express app inside the `/identity-provider` folder following the structure outlined in Section 6. Implement the `/login` route, JWT generation, and set up Redis rate-limiting inside a Dockerfile using the Multi-Stage template."*
- *"Agent, generate the root `docker-compose.yml` file mapping out all 6 microservices, Redis, and Postgres as described in the Master Plan."*
