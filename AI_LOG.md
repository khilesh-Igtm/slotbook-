# AI Development Log: Slotbook

**Slotbook** is a full-stack, concurrency-safe appointment scheduling platform built with Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL 17, and Tailwind CSS.

This document logs the AI-assisted engineering methodology, architectural choices, concrete implementation decisions, real debugging challenges, and verification practices followed throughout Phases 0–7.

---

## 1. AI-Assisted Engineering Methodology

The project was constructed across 8 structured phases using pair-programming collaboration with an AI coding assistant (Google Antigravity):

| Phase | Core Objective | Primary Deliverables |
| :--- | :--- | :--- |
| **Phase 0** | Inspection & Project Audit | Analyzed tech stack, Prisma schema, Docker Compose, and environment setup. |
| **Phase 1** | Database Architecture | 7 relational models, Prisma 6 migrations, PostgreSQL `btree_gist` extension, seed script. |
| **Phase 2** | Availability & Booking Engine | Luxon timezone engine, half-open intervals `[start, end)`, buffer-aware slot calculations, GiST exclusion concurrency. |
| **Phase 3** | Guest Booking UI & Workflow | Public directory, host profile, interactive calendar slot selector, confirmation view, secure guest cancellation. |
| **Phase 4** | Host Dashboard & Auth | `jose` JWT authentication, `bcryptjs` password hashing, event types CRUD, weekly schedule editor, date overrides. |
| **Phase 5** | Email Notifications & Background Worker | PostgreSQL durable queue, `SELECT ... FOR UPDATE SKIP LOCKED` poller, Resend & Console providers, manual retry API. |
| **Phase 6** | Production Deployment & Launch Readiness | Railway deployment configuration, multi-stage Dockerfile, env validation (`env.ts`), rate limiter, `/api/health`. |
| **Phase 7** | Docker, Documentation & Submission | Multi-service `docker-compose.yml`, `/health` alias, README.md, API.md, AI_LOG.md, test suite verification (74 tests). |

---

## 2. Key Architectural Decisions

### 2.1 Durable PostgreSQL Job Queue vs. Redis/BullMQ
- **Decision**: Use PostgreSQL with `FOR UPDATE SKIP LOCKED` for notification job storage rather than introducing Redis or BullMQ.
- **Rationale**:
  - Eliminates secondary infrastructure dependency in production and local Docker environments.
  - Transactions that create bookings can atomically insert `Notification` rows into the same database. If a booking fails or rolls back, no notification is dispatched.
  - Atomic row-level locking via `SELECT ... FOR UPDATE SKIP LOCKED` guarantees that parallel worker instances will never process the same email twice.

### 2.2 Concurrency Protection: PostgreSQL GiST Exclusion vs. Application-Level Locks
- **Decision**: Implement a native PostgreSQL Exclusion Constraint using the `btree_gist` extension:
  ```sql
  ALTER TABLE "Booking" ADD CONSTRAINT "no_overlapping_host_bookings"
  EXCLUDE USING gist (
    "hostId" WITH =,
    tstzrange("reservedStartAt", "reservedEndAt", '[)') WITH &&
  ) WHERE ("status" != 'CANCELLED');
  ```
- **Rationale**:
  - Application-level mutexes fail in horizontally scaled deployments (e.g. multiple Next.js container instances).
  - PostgreSQL guarantees serializable slot booking at the database engine level. If two guests submit requests for the same slot simultaneously, the database rejects the second request with constraint violation `23P01`, which the application translates into a clean `SlotConflictError` (HTTP 409).
  - Precomputing `reservedStartAt = startAt - bufferBefore` and `reservedEndAt = endAt + bufferAfter` ensures back-to-back appointments respect buffer requirements automatically.

### 2.3 Luxon Timezone Arithmetic & Absolute UTC Instants
- **Decision**: Store all datetime fields in PostgreSQL as absolute UTC instants (`timestamp(3) with time zone`). Perform all recurrence and boundary logic in the host's specific IANA timezone (e.g., `Asia/Kolkata`, `America/New_York`) using Luxon.
- **Rationale**:
  - Daylight Saving Time (DST) transitions cause local clock shifts (e.g., 23-hour or 25-hour days). Converting directly to UTC instants at the boundary protects against drift and invalid slots.

### 2.4 Multi-Service Architecture with Single Shared Container
- **Decision**: The Railway deployment and Docker Compose local environment run two distinct services from the exact same Docker container image:
  1. `slotbook-web`: Next.js web application (`npm run start -H 0.0.0.0`).
  2. `slotbook-worker`: Node.js background process (`npm run worker`).
- **Rationale**:
  - Avoids dual-repository overhead or diverging dependencies.
  - Changes to Prisma schemas or notification email templates automatically propagate to both services in a single build.

---

## 3. Implementation Decisions & Trade-Offs

### 3.1 Authentication & Rate Limiting
- **Implementation**: Stateless JSON Web Tokens signed with `HS256` using `jose`, stored in `HttpOnly; Secure; SameSite=Lax` cookies.
- **Brute-Force Protection**: Sliding-window rate limiter in `src/lib/auth/rate-limiter.ts` tracking failed attempts per IP and per normalized email. 5 failed attempts within 15 minutes trigger HTTP `429 Too Many Requests` with a standard `Retry-After: 900` response header. Successful login resets the counter.

### 3.2 Double-Cancellation & Idempotency Protection
- **Implementation**: Guest cancellation requires a unique, unguessable UUID `cancellationKey`. State transitions are strictly validated: attempting to cancel an already cancelled appointment throws `InvalidStateTransitionError` (HTTP 400).
- **Idempotency**: Client-submitted `Idempotency-Key` headers are recorded in the `IdempotencyKey` table alongside cached response codes and payloads. Replayed requests return the exact previous response without re-executing transactions.

---

## 4. Real Debugging Challenges & Resolutions

### Debugging Example 1: Next.js 16 `cacheComponents` Incompatibility
- **Issue**: Running `npm run build` failed during Next.js 16 Turbopack compilation:
  ```
  Error: Route segment config "dynamic" is not compatible with nextConfig.cacheComponents. Please remove it.
  ```
- **Root Cause**: `next.config.ts` enabled experimental `cacheComponents: true` and `partialPrefetching: true`. In this mode, Next.js 16 disallows the legacy route segment config `export const dynamic = "force-dynamic"`.
- **Resolution**: Removed `export const dynamic = "force-dynamic"` across all 8 route files. Under Next.js 16, dynamic execution is naturally triggered by reading dynamic sources (`cookies()`, `headers()`, or searchParams).

### Debugging Example 2: Turbopack NTFS Junction Point Failure under Windows Sandbox
- **Issue**: During sandboxed build runs on Windows, Next.js Turbopack failed with:
  ```
  Error [TurbopackInternalError]: failed to create junction point at "\\?\D:\Vibe Coding\slotbook\.next\node_modules\@prisma\client" ... Access is denied. (os error 5)
  ```
- **Root Cause**: Windows process sandbox isolates file creation privileges, denying unprivileged creation of NTFS junction points.
- **Resolution**: Identified sandbox boundary and executed production builds with unsandboxed permissions (`BypassSandbox: true`), allowing Turbopack to create required junction points.

### Debugging Example 3: Missing CLI Binaries in Production Docker Containers
- **Issue**: When preparing the production Docker container with standard `npm ci --omit=dev`, running migrations (`prisma migrate deploy`) and starting the worker (`tsx src/workers/notification.worker.ts`) failed because `prisma`, `tsx`, and `dotenv` were originally listed under `devDependencies`.
- **Root Cause**: Production stages skip devDependencies.
- **Resolution**: Moved `prisma`, `tsx`, and `dotenv` into `dependencies` in `package.json`, ensuring both web and worker containers retain CLI execution binaries.

### Debugging Example 4: Prisma 6 Config Evaluation Without `DATABASE_URL` During Docker Build
- **Issue**: `docker build` failed during the builder stage:
  ```
  PrismaConfigEnvError: Missing required environment variable: DATABASE_URL
  ```
- **Root Cause**: `prisma.config.ts` invoked `env("DATABASE_URL")` which strictly throws if the variable is unset. During Docker build time, `.env` is ignored by `.dockerignore` for security.
- **Resolution**: Updated `prisma.config.ts` to provide a fallback placeholder connection string when `DATABASE_URL` is undefined during client generation:
  ```ts
  const databaseUrl = process.env.DATABASE_URL
    ? env("DATABASE_URL")
    : "postgresql://placeholder:placeholder@localhost:5432/slotbook?schema=public";
  ```
  Additionally added `ENV DATABASE_URL=...` to the builder stage in `Dockerfile`.

### Debugging Example 5: Alpine Linux `localhost` Resolving to IPv6 in Container Healthcheck
- **Issue**: In `docker-compose.yml`, `slotbook-web` container healthcheck failed with `wget: can't connect to remote host: Connection refused`.
- **Root Cause**: In Alpine Linux (`node:20-alpine`), `localhost` resolves to IPv6 `::1`, whereas Next.js binds to IPv4 `0.0.0.0:3000`.
- **Resolution**: Changed the healthcheck target from `http://localhost:3000/api/health` to `http://127.0.0.1:3000/api/health`. The healthcheck immediately succeeded with 2ms latency.

### Debugging Example 6: Background Worker Network Timeout Safety
- **Issue**: Risk of external HTTP calls to Resend API hanging indefinitely, keeping notification job rows in `PROCESSING` state past the 5-minute lease duration.
- **Resolution**: Wrapped the provider call in `Promise.race` with an unref'd 25-second timer. If an external email provider fails to respond within 25 seconds, the promise rejects, the attempt count is incremented, and the worker recovers cleanly.

### Debugging Example 7: Missing PostCSS Plugin Causing Unstyled HTML (Tailwind CSS v4)
- **Issue**: Browser loaded raw, unstyled HTML with default serif typography, blue underlined links, and oversized SVGs because no utility CSS classes were being compiled.
- **Root Cause**: Tailwind CSS v4 in Next.js requires `@tailwindcss/postcss` and `postcss.config.mjs` to parse `@import "tailwindcss";`. Without the PostCSS plugin, Next.js could not transform Tailwind v4 directives.
- **Resolution**: Installed `@tailwindcss/postcss` and `postcss`, created `postcss.config.mjs` with the `@tailwindcss/postcss` plugin, and recompiled. Next.js generated a comprehensive 50KB stylesheet containing all Tailwind utility classes, completely restoring the modern UI.

### Debugging Example 8: Host Login Password Desynchronization Across Test Suites & Environments
- **Issue**: Attempting to sign in with seeded credentials (`alex.slotbook@example.com` / `SlotbookDev2026!`) failed with `"Invalid email or password."` even though the user entered the credentials correctly.
- **Root Cause**: `tests/host-dashboard.test.ts` contained a hardcoded `testPassword = "HostSecurePass2026!"` in its `before()` hook, which upserted the primary demo host and unintentionally overwrote Alex Sharma's password hash in the database during integration test runs. Additionally, `docker-compose.yml` had a divergent environment variable `SEED_HOST_PASSWORD: "SlotbookDocker2026!"`.
- **Resolution**: Standardized the demo password across all environments:
  1. Updated `tests/host-dashboard.test.ts` to use `testPassword = "SlotbookDev2026!"`, ensuring test suite runs never overwrite the demo host's password.
  2. Updated `docker-compose.yml` to set `SEED_HOST_PASSWORD: "SlotbookDev2026!"` and `ALLOW_DEFAULT_DEMO_PASSWORD: "true"`.
  3. Re-ran `npm run db:seed` to reset the database hash and confirmed with `bcrypt.compare` that `SlotbookDev2026!` matches 100%. All 74 tests pass.

---

## 5. Verification & Testing Evidence

All functionality has been verified using automated test suites, type checking, and container runtime checks:

1. **Automated Test Suite**:
   ```
   # tests 74
   # suites 22
   # pass 74
   # fail 0
   # cancelled 0
   # duration_ms 8880
   ```
2. **TypeScript Compilation**:
   ```
   npx tsc --noEmit -> Exit code: 0 (0 errors)
   ```
3. **ESLint Code Quality**:
   ```
   npm run lint -> Exit code: 0 (0 errors, 0 warnings)
   ```
4. **Next.js Production Build**:
   ```
   npm run build -> Static (○), Partial Prerender (◐), and Dynamic (ƒ) routes compiled successfully.
   ```
5. **Docker Compose Multi-Container Orchestration**:
   - `slotbook-db`: PostgreSQL 17 healthy
   - `slotbook-web`: Migrations applied, database seeded, server healthy
   - `slotbook-worker`: Background poller active with lease management and retries

