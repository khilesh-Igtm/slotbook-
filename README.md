# Slotbook — Concurrency-Safe Appointment Scheduling Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-74%2F74%20Passing-brightgreen?style=flat)]()

**Slotbook** is a full-stack, production-grade appointment scheduling platform designed to solve the critical concurrency, timezone, and reliability problems of modern calendar booking systems. 

Built from the ground up with **Next.js 16 App Router**, **Prisma ORM 6**, and **PostgreSQL 17**, Slotbook guarantees **zero double bookings** under high concurrency through database-level GiST exclusion constraints, eliminates timezone drift via UTC normalization, and delivers reliable asynchronous emails using a PostgreSQL-backed job queue with `SKIP LOCKED` lease management.

---

## Table of Contents
1. [The Problem Slotbook Solves](#the-problem-slotbook-solves)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Folder Structure](#folder-structure)
6. [Prerequisites](#prerequisites)
7. [Quickstart: Run with Docker Compose](#quickstart-run-with-docker-compose)
8. [Local Development Setup](#local-development-setup)
9. [Environment Variables](#environment-variables)
10. [Database Management & Migrations](#database-management--migrations)
11. [Default Demo Credentials](#default-demo-credentials)
12. [Production Host Provisioning](#production-host-provisioning)
13. [API Documentation](#api-documentation)
14. [Security & Rate Limiting](#security--rate-limiting)
15. [Automated Verification & Testing](#automated-verification--testing)
16. [Production Deployment (Railway)](#production-deployment-railway)
17. [Documentation Links](#documentation-links)

---

## The Problem Slotbook Solves

Standard scheduling apps frequently suffer from three architectural failure modes:
1. **Race Conditions & Double Bookings**: When two users select the same slot simultaneously, application-level checks fail because both read operations perceive the slot as available before either write completes. Slotbook solves this with **PostgreSQL GiST Exclusion Constraints (`btree_gist`)**, rejecting concurrent overlaps at the storage engine level.
2. **Timezone Shifts & Daylight Saving Time (DST)**: Booking systems that store local clock times or naive dates corrupt schedules when transitions occur (e.g., 23-hour or 25-hour days). Slotbook normalizes all stored instants to absolute UTC while computing slot availability in the host's specific IANA timezone using **Luxon**.
3. **Lost Notifications & Infrastructure Sprawl**: Introducing external message brokers (e.g. Redis, RabbitMQ) adds points of failure and prevents transactional consistency. Slotbook utilizes **PostgreSQL as a durable job queue**, ensuring notification records are created transactionally with the booking itself.

---

## Key Features

### 👤 Guest Experience
- **Public Booking Profile**: Clean, responsive host profile page displaying available event types and host bio (`/book/[hostSlug]`).
- **Interactive Slot Picker**: Fast calendar and slot selection respecting weekly hours, date overrides, buffers, and past times (`/book/[hostSlug]/[eventSlug]`).
- **Instant Confirmation**: Detailed booking confirmation with host details, timezone, and calendar metadata (`/bookings/[bookingId]`).
- **Secure Guest Cancellation**: Token-authorized cancellation allowing guests to release their slot without authentication.

### 🛡️ Host Administration Dashboard
- **Dashboard Overview**: Metrics tracking upcoming, confirmed, and cancelled appointments (`/dashboard`).
- **Event Types CRUD**: Create and manage meeting types, custom durations, locations, and buffer times before/after (`/dashboard/events`).
- **Weekly Schedule Manager**: Configure multi-window recurring availability per weekday (`/dashboard/availability`).
- **Date Overrides & Exceptions**: Block full-day holidays (e.g. Christmas Day) or configure custom operating hours for specific dates (`/dashboard/availability/exceptions`).
- **Booking Management & Cancellation**: View guest information, inspect appointment status, and cancel appointments directly from the dashboard.
- **Notification Observability & Manual Retry**: Inspect email delivery attempts and trigger instant manual re-queuing for failed notification jobs.

### ⚡ Concurrency & Reliability
- **PostgreSQL GiST Exclusion Constraint**: Guarantees zero overlapping bookings across distributed web servers.
- **Buffer-Aware Intervals**: Precomputes `reservedStartAt = startAt - bufferBefore` and `reservedEndAt = endAt + bufferAfter` to enforce travel/prep time.
- **Idempotency Service**: Prevents duplicate bookings from client network retries via `Idempotency-Key` headers.
- **Durable Notification Worker**: Independent background process claiming pending jobs using `SELECT ... FOR UPDATE SKIP LOCKED` with lease timeout recovery and exponential backoff retries.
- **Login Rate Limiter**: In-memory sliding-window brute-force protection (5 failed attempts per 15 min per IP/email) returning HTTP 429.
- **Active Health Endpoint**: `/health` and `/api/health` checking PostgreSQL round-trip query latency and container uptime.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 16.4.5 (App Router, Turbopack, Partial Prerendering) |
| **Language** | TypeScript 5.9 (Strict mode, zero emit errors) |
| **ORM & Database** | Prisma 6.19.3, PostgreSQL 17 (`btree_gist` extension) |
| **Styling & UI** | Tailwind CSS 4, Heroicons-inspired clean SVG components |
| **Timezone Engine** | Luxon 3.5 (IANA timezone parsing, half-open intervals) |
| **Authentication** | `jose` (HS256 stateless JWT session), `bcryptjs` (password hashing) |
| **Validation** | Zod 3.24 (Request validation, environment schema) |
| **Email Delivery** | Resend API SDK + Local Console Email Provider |
| **Testing** | Node.js Test Runner (`node:test`, `node:assert`), `tsx` |
| **Containerization** | Multi-stage Dockerfile, Docker Compose v2 |

---

## System Architecture

```
                                  ┌──────────────────────────────┐
                                  │   Browser / Guest / Host     │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │   Next.js 16 Web Service     │
                                  │   (App Router, Port 3000)    │
                                  │   - Booking & Slot Engine    │
                                  │   - Host Dashboard & Auth    │
                                  │   - Rate Limiter (/login)    │
                                  │   - Health Probe (/health)   │
                                  └──────────────┬───────────────┘
                                                 │
                               ┌─────────────────┴─────────────────┐
                               │ Transactional Writes / Migrations │
                               ▼                                   ▼
┌────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────┐
│             PostgreSQL 17 Database             │   │        Notification Background Worker          │
│ - Tables: Host, EventType, Availability,       │   │        (`src/workers/notification.worker.ts`)  │
│   DateOverride, Booking, Notification,         │ ◄─┤ - Polls: SELECT ... FOR UPDATE SKIP LOCKED     │
│   IdempotencyKey                               │   │ - Lease: 5 min lease, recovers stalled jobs    │
│ - GiST Exclusion: No overlapping bookings      │   │ - Retries: 5 attempts exponential backoff      │
│ - Persistent volume: slotbook_postgres_data    │   └───────────────────────┬────────────────────────┘
└────────────────────────────────────────────────┘                           │
                                                                             ▼
                                                             ┌────────────────────────────────┐
                                                             │   Resend API / Console Log     │
                                                             └────────────────────────────────┘
```

---

## Folder Structure

```
slotbook/
├── .github/                # GitHub templates & workflows
├── docs/                   # Exhaustive project documentation
│   ├── API.md              # 19 REST endpoints specification
│   ├── DEPLOYMENT.md       # Step-by-step Railway deployment guide
│   └── WALKTHROUGH.md      # 60-second walkthrough script & screenshot checklist
├── prisma/                 # Database schema & migrations
│   ├── migrations/         # 5 reproducible PostgreSQL migrations
│   │   ├── 20261106000000_init/
│   │   ├── 20261106120000_add_buffer_exclusion_constraint/
│   │   ├── 20261106150000_add_cancellation_key/
│   │   ├── 20261106161000_add_host_password_hash/
│   │   └── 20261106170000_extend_notification_for_worker/
│   ├── schema.prisma       # 7 core database models
│   └── seed.ts             # Idempotent demo host & schedule seeder
├── src/
│   ├── app/                # Next.js App Router (UI & APIs)
│   │   ├── api/            # Route handlers (Auth, Bookings, Dashboard, Health)
│   │   ├── book/           # Public booking pages (/book/[hostSlug]/[eventSlug])
│   │   ├── bookings/       # Guest confirmation & cancellation page
│   │   ├── dashboard/      # Host administration dashboard pages
│   │   ├── health/         # Root /health alias route
│   │   ├── login/          # Host login page
│   │   └── page.tsx        # Public landing page & host directory
│   ├── components/         # Modular React server & client components
│   │   ├── booking/        # Calendar, slot picker, booking modal, details view
│   │   └── dashboard/      # Navigation, stats, event modal, schedule editor
│   ├── lib/                # Core business logic & services
│   │   ├── auth/           # Session management & rate limiting
│   │   ├── config/         # Zod environment validation (env.ts)
│   │   ├── notifications/  # Notification service, templates & providers
│   │   ├── services/       # Availability engine, booking service, dashboard
│   │   ├── validations/    # Zod schemas for bookings, auth, and events
│   │   ├── errors.ts       # Domain error taxonomy (SlotConflictError, etc.)
│   │   └── prisma.ts       # Singleton PrismaClient instance
│   ├── scripts/            # CLI utilities (create-host.ts)
│   └── workers/            # Background worker (notification.worker.ts)
├── tests/                  # 74 automated unit & integration tests
├── .dockerignore           # Production Docker context exclusion
├── .env.example            # Documented environment template
├── AI_LOG.md               # AI development methodology & debugging log
├── docker-compose.yml      # Multi-service local stack orchestration
├── Dockerfile              # Multi-stage production container build
├── package.json            # Scripts, dependencies, and configuration
├── prisma.config.ts        # Prisma 6 runtime configuration
└── tsconfig.json           # TypeScript strict compiler configuration
```

---

## Prerequisites

- **Node.js**: v20.x or higher (v20-alpine used in containers)
- **npm**: v10.x or higher
- **Docker & Docker Compose**: (Optional, for one-command containerized run)
- **PostgreSQL 17**: (If running locally without Docker)

---

## Quickstart: Run with Docker Compose

To run the complete application (**PostgreSQL 17 Database + Web Application + Notification Background Worker**) with automatic database migration and demo data seeding in one command:

```bash
# 1. Clone repository
git clone https://github.com/khilesh-Igtm/slotbook-.git
cd slotbook-

# 2. Start the full stack
docker compose up -d
```

> **Note on Port Overrides**: If host ports `5432` or `3000` are already in use on your machine, pass alternative published ports:
> ```bash
> DB_PORT=5433 WEB_PORT=3005 docker compose up -d
> ```

### What Docker Compose Executes Automatically:
1. Starts `slotbook-db` (PostgreSQL 17) and awaits its healthy status (`pg_isready`).
2. Builds and starts `slotbook-web`, automatically running `npx prisma migrate deploy` and `npx prisma db seed`.
3. Starts `slotbook-worker` once the web service is healthy, beginning background job polling.

Open your browser:
- **Landing Page & Host Directory**: [http://localhost:3000](http://localhost:3000)
- **Demo Host Booking Page**: [http://localhost:3000/book/alex-sharma](http://localhost:3000/book/alex-sharma)
- **Host Dashboard Login**: [http://localhost:3000/login](http://localhost:3000/login)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

To view live container logs:
```bash
docker compose logs -f web
docker compose logs -f worker
```

To stop all services:
```bash
docker compose down
```

---

## Local Development Setup

If you prefer running Next.js and PostgreSQL directly on your host machine:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance:
```env
DATABASE_URL="postgresql://slotbook:slotbook_dev_password@localhost:5432/slotbook?schema=public"
SESSION_SECRET="your_secure_development_secret_min_32_characters!"
APP_BASE_URL="http://localhost:3000"
EMAIL_PROVIDER="console"
```

### 3. Run Migrations & Seed Database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start Background Notification Worker (Separate Terminal)
```bash
npm run worker
```

---

## Environment Variables

| Variable | Description | Default / Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `SESSION_SECRET` / `JWT_SECRET` | Secret key for signing host JWT session cookies (min 32 chars in production) | Required |
| `APP_BASE_URL` | Canonical application URL used in notification links | `http://localhost:3000` |
| `PORT` | Web server listening port | `3000` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `EMAIL_PROVIDER` | Email delivery service (`console` or `resend`) | `console` |
| `RESEND_API_KEY` | Resend API key (required if `EMAIL_PROVIDER=resend`) | `re_placeholder...` |
| `EMAIL_FROM` | Sender email address for notifications | `Slotbook <notifications@slotbook.app>` |
| `NOTIFICATION_POLL_INTERVAL_MS`| Worker polling interval in milliseconds | `5000` |
| `NOTIFICATION_LOCK_TIMEOUT_MS` | Job lease timeout before recovering abandoned jobs | `300000` (5 min) |
| `ALLOW_PRODUCTION_SEED` | Guard preventing accidental seed runs in production | `false` |
| `SEED_HOST_PASSWORD` | Password used during database seeding | `SlotbookDev2026!` |

---

## Database Management & Migrations

Slotbook uses Prisma 6 with strict PostgreSQL migrations. **Never use `db push` in production.**

```bash
# Generate Prisma Client
npm run db:generate

# Create a new migration during local development
npm run db:migrate

# Apply pending migrations safely in staging/production (Zero Data Loss)
npm run db:migrate:deploy

# Seed the database
npm run db:seed

# Launch Prisma Studio database GUI
npm run db:studio
```

---

## Default Demo Credentials

The database seeder provisions a fully functional demo host with realistic event types, weekly hours, and holiday date overrides:

| Role | Email | Password | Slug | Timezone |
| :--- | :--- | :--- | :--- | :--- |
| **Demo Host** | `alex.slotbook@example.com` | `SlotbookDev2026!` | `alex-sharma` | `Asia/Kolkata` |

### Preconfigured Data:
- **Event Types**:
  1. *30-Minute Meeting*: 30m duration, 5m buffer before, 5m buffer after (Google Meet).
  2. *60-Minute Consultation*: 60m duration, 10m buffer before, 10m buffer after (Google Meet).
- **Weekly Schedule**: Monday to Friday, `09:00` – `17:00` (Asia/Kolkata).
- **Date Overrides**:
  - `2026-12-24` (Christmas Eve): Custom shortened hours (`09:00` – `13:00`).
  - `2026-12-25` (Christmas Day): Full-day unavailability.

---

## Production Host Provisioning

In production environments, automatic demo seeding is blocked by default for security. To provision new host accounts, use the included CLI tool:

```bash
# Interactive or parameterized host creation
npm run create-host -- --email "host@company.com" --name "Jane Doe" --password "YourStrongPassword123!" --timezone "America/New_York"
```

The script hashes the password with 12 rounds of bcrypt and provisions default availability schedules and meeting types automatically.

---

## API Documentation

Slotbook features 19 fully tested REST API endpoints covering health, authentication, public scheduling, guest bookings, host dashboard, and notification management.

👉 **[Read the Full API Specification in docs/API.md](docs/API.md)**

Quick Endpoint Overview:
- `GET /health` & `GET /api/health`: Active health check with PostgreSQL query latency.
- `POST /api/auth/login`: Rate-limited host login.
- `GET /api/hosts/:hostId/event-types`: Public active event types.
- `GET /api/hosts/:hostId/event-types/:eventTypeId/availability`: Real-time available slots for `?date=YYYY-MM-DD`.
- `POST /api/bookings`: Concurrency-safe booking reservation with idempotency support.
- `POST /api/bookings/:bookingId/cancel`: Token-authorized guest cancellation.
- `GET /api/dashboard/events`: Host event types management.
- `PUT /api/dashboard/availability`: Atomic weekly schedule updater.
- `POST /api/dashboard/bookings/:bookingId/notifications/:id/retry`: Manual failed email retry.

---

## Security & Rate Limiting

1. **Brute-Force Rate Limiting**: The `/api/auth/login` endpoint uses an in-memory sliding-window rate limiter allowing a maximum of 5 failed attempts per 15 minutes per IP/email. Exceeding the threshold returns HTTP `429 Too Many Requests` with `Retry-After: 900`.
2. **Session Cookies**: Authentication tokens are signed with `HS256` using `jose` and delivered via `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies.
3. **Cross-Host Authorization**: Every dashboard endpoint validates that the authenticated host strictly owns the targeted event, schedule, booking, or notification entity.
4. **Non-Root Docker Execution**: Containers run under unprivileged system user `nextjs` (UID 1001).
5. **No Secret Leakage**: Health checks and error formatters sanitize internal traces, database passwords, and connection strings.

---

## Automated Verification & Testing

Slotbook maintains a comprehensive test suite executed with Node.js built-in test runner:

```bash
# Run all 74 unit, integration, and concurrency tests
npm test

# Run TypeScript compiler check (0 errors)
npx tsc --noEmit

# Run ESLint validation (0 warnings, 0 errors)
npm run lint

# Run Next.js production build
npm run build
```

### Verified Test Suites (74/74 Passing):
- `tests/api-routes.test.ts`: Public API lifecycle and error handling.
- `tests/availability.test.ts`: Weekly hours, overrides, buffers, DST, and timezone math.
- `tests/booking-service.test.ts`: Slot reservation, duration calculation, and cancellation.
- `tests/concurrency-integration.test.ts`: Concurrent parallel requests against PostgreSQL GiST constraint.
- `tests/idempotency.test.ts`: Duplicate request replay and cached response integrity.
- `tests/host-dashboard.test.ts`: Host authentication, event CRUD, schedule updates, and isolation.
- `tests/notifications.test.ts`: Background worker claiming, lease timeouts, retries, and cancellation skips.
- `tests/production-readiness.test.ts`: Healthcheck, rate limiter, env validator, and Docker security audits.

---

## Production Deployment (Railway)

Slotbook is optimized for zero-downtime deployment on **Railway** using a 3-service architecture:
1. **Web Service (`slotbook-web`)**: Next.js App Router container.
2. **Worker Service (`slotbook-worker`)**: Background notification processor running `npm run worker`.
3. **Database Service**: Railway-managed PostgreSQL 17 cluster.

👉 **[Read the Complete Deployment Guide in docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## Documentation Links

- **[API Specification](docs/API.md)**: Exhaustive endpoint documentation with request/response examples.
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Complete step-by-step instructions for Railway.
- **[Product Walkthrough & Screenshot Checklist](docs/WALKTHROUGH.md)**: 60-second walkthrough script and visual asset guide.
- **[AI Development Log](AI_LOG.md)**: Architectural decisions, implementation trade-offs, and debugging history.

---

## License

This project is licensed under the MIT License.
