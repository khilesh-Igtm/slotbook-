# Slotbook Production Deployment Guide: Railway

This guide walks through deploying **Slotbook** on [Railway](https://railway.app) using a 3-service architecture:
1. **Web Service**: Next.js App Router full-stack web application.
2. **Worker Service**: Background notification processing worker (`src/workers/notification.worker.ts`).
3. **Database Service**: Railway-managed PostgreSQL 17 database.

Both the Web and Worker services build from the exact same Git repository and connect to the single shared PostgreSQL database.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Incoming HTTPS                  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │         Railway Web Service (Next.js)        │
                      │  - Port 3000 (binds 0.0.0.0)                 │
                      │  - Serves UI, booking flow, host dashboard   │
                      │  - Inserts PENDING notification jobs         │
                      └──────────────────────┬───────────────────────┘
                                             │
                       Shared DATABASE_URL   │  (SELECT ... FOR UPDATE SKIP LOCKED)
                                             │
            ┌────────────────────────────────┴────────────────────────────────┐
            ▼                                                                 ▼
┌───────────────────────────┐                                   ┌───────────────────────────┐
│ Railway-Managed Database  │ ◄─────────────────────────────────┤  Railway Worker Service   │
│ - PostgreSQL 17           │                                   │  - npm run worker         │
│ - GiST exclusion index    │                                   │  - Asynchronous poller    │
│ - Persistent volume       │                                   │  - Resend email provider  │
└───────────────────────────┘                                   └─────────────┬─────────────┘
                                                                              │
                                                                              ▼
                                                                ┌───────────────────────────┐
                                                                │  Resend Email API / SMTP  │
                                                                └───────────────────────────┘
```

---

## 1. Prerequisites

Before starting, ensure you have:
- A [Railway account](https://railway.app).
- A [Resend account](https://resend.com) with a verified sending domain.
- A GitHub repository containing the latest Slotbook codebase.
- OpenSSL CLI or Node.js to generate strong secrets.

---

## 2. Step-by-Step Railway Provisioning

### Step 2.1: Create a Railway Project
1. Log into Railway and click **New Project**.
2. Select **Provision PostgreSQL**.
3. Railway will provision a dedicated PostgreSQL 17 database with persistent storage.

### Step 2.2: Inspect Database Connection
1. Click on the newly created **Postgres** service card in Railway.
2. Navigate to the **Variables** tab.
3. Note the provided variable `DATABASE_URL` (e.g. `postgresql://postgres:password@junction.proxy.rlwy.net:PORT/railway`).
   - Railway services linked to this database can automatically reference `${{Postgres.DATABASE_URL}}`.

---

## 3. Provisioning the Web Service

1. In the same Railway project canvas, click **New Service** &rarr; **GitHub Repo**.
2. Select your `slotbook` repository.
3. Rename the service to **Slotbook Web**.

### 3.1 Configure Web Build & Deploy Settings
Under **Settings** &rarr; **Build**:
- **Builder**: `DOCKERFILE` (or `NIXPACKS`).
  - If using Dockerfile: Railway automatically detects the root [`Dockerfile`](file:///d:/Vibe%20Coding/slotbook/Dockerfile).
- **Pre-deploy Command** (Under **Deploy** &rarr; **Release Command**):
  ```bash
  npx prisma migrate deploy
  ```
  > [!IMPORTANT]
  > Configuring `npx prisma migrate deploy` in the Web service's release/pre-deploy hook guarantees that database migrations run idempotently before traffic routes to the new release, without race conditions from multiple services.

Under **Settings** &rarr; **Deploy**:
- **Start Command**: `npm run start` (or leave default if using Dockerfile).
- **Healthcheck Path**: `/api/health`
- **Healthcheck Timeout**: `120` seconds
- **Restart Policy**: `On Failure` (Max retries: 10)

### 3.2 Configure Web Environment Variables
Navigate to **Variables** on the **Slotbook Web** service and add:

| Variable Name | Value / Reference | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Connects to shared PostgreSQL |
| `NODE_ENV` | `production` | Enables production optimizations |
| `SESSION_SECRET` | *(Generated 32+ char secret)* | See Step 5 for generation |
| `APP_BASE_URL` | `https://your-custom-domain.com` | Or Railway generated domain |
| `EMAIL_PROVIDER` | `resend` | Use `resend` in production |
| `RESEND_API_KEY` | `re_123456789...` | From Resend dashboard |
| `EMAIL_FROM` | `Slotbook <notifications@yourdomain.com>` | Must match verified domain |
| `REMINDER_LEAD_HOURS` | `24` | Hours prior to appointment |
| `NOTIFICATION_POLL_INTERVAL_MS` | `5000` | Polling frequency |
| `NOTIFICATION_MAX_ATTEMPTS` | `5` | Max delivery attempts |
| `NOTIFICATION_LOCK_TIMEOUT_MS` | `300000` | 5-minute lease timeout |

---

## 4. Provisioning the Notification Worker Service

1. In the same Railway canvas, click **New Service** &rarr; **GitHub Repo**.
2. Select the **same** `slotbook` repository.
3. Rename the service to **Slotbook Worker**.

### 4.1 Configure Worker Deploy Settings
Under **Settings** &rarr; **Deploy**:
- **Custom Start Command**:
  ```bash
  npm run worker
  ```
- **Restart Policy**: `Always` or `On Failure`.
- **Healthcheck Path**: *(Leave empty — worker is a background daemon process without an HTTP listener)*.

### 4.2 Configure Worker Environment Variables
The Worker service requires the **exact same** database connection and email credentials:

| Variable Name | Value / Reference |
| :--- | :--- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://your-custom-domain.com` (for links inside emails) |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | `re_123456789...` |
| `EMAIL_FROM` | `Slotbook <notifications@yourdomain.com>` |
| `REMINDER_LEAD_HOURS` | `24` |
| `NOTIFICATION_POLL_INTERVAL_MS` | `5000` |
| `NOTIFICATION_MAX_ATTEMPTS` | `5` |
| `NOTIFICATION_LOCK_TIMEOUT_MS` | `300000` |

> [!TIP]
> In Railway, you can create a **Shared Variable Group** to keep common variables (`DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`) synchronized between Web and Worker services automatically.

---

## 5. Security & Secret Generation

### 5.1 Generate Strong Session Secret
Never use a development secret in production. Generate a high-entropy 256-bit secret using OpenSSL:

```bash
openssl rand -base64 32
```
Example output: `a94kZ2j+wX2N8u7g/2Lw1B9qR+K6T3mQ8sA4vE1wZ0k=`

Set this value as `SESSION_SECRET` (or `JWT_SECRET`) in your Railway Web service.

### 5.2 Resend Domain Verification
1. In the Resend Console, navigate to **Domains** &rarr; **Add Domain**.
2. Enter your root domain or subdomain (e.g. `mail.slotbook.app`).
3. Add the provided `MX`, `TXT` (SPF), and `DKIM` DNS records to your domain registrar (Cloudflare, Route53, Namecheap, etc.).
4. Once verified, configure `EMAIL_FROM` to use this domain:
   ```bash
   EMAIL_FROM="Slotbook Notifications <noreply@mail.slotbook.app>"
   ```

---

## 6. Database Migration Strategy

### 6.1 Safe Production Migrations
In production, database migrations are applied using:
```bash
npx prisma migrate deploy
```
- **Idempotent**: Applies pending migrations from `prisma/migrations` in strict order.
- **Never Resets**: Will never drop tables or delete production data.
- **Automated**: Placed in the Railway Web service pre-deploy command so schema updates apply before traffic switches.

### 6.2 Manual Migration Check via Railway CLI
If you prefer running migrations manually:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Link your project
railway link

# Run migration against production database
railway run npm run db:migrate:deploy
```

---

## 7. Creating the First Production Host Account

In production mode (`NODE_ENV=production`), automatic seeding with demo passwords is strictly blocked for security.

To provision your initial host account in production:

### Option A: Using the CLI Script via Railway CLI (Recommended)
```bash
railway run npm run create-host -- \
  --name "Dr. Jane Doe" \
  --email "jane.doe@company.com" \
  --slug "jane-doe" \
  --timezone "America/New_York" \
  --password "YourStrongProductionPassword2026!"
```

This creates the host record, generates a secure bcrypt hash, and seeds initial Monday–Friday availability and a default 30-minute meeting type.

### Option B: Using Seed with Explicit Production Flags
```bash
railway run bash -c "ALLOW_PRODUCTION_SEED=true SEED_HOST_PASSWORD='YourStrongCustomPassword2026!' npm run db:seed"
```

---

## 8. Custom Domains & HTTPS

1. In Railway, open the **Slotbook Web** service.
2. Go to **Settings** &rarr; **Networking** &rarr; **Custom Domain**.
3. Enter your domain (e.g. `booking.yourdomain.com`).
4. Add the `CNAME` record provided by Railway to your DNS provider.
5. Railway automatically provisions and renews SSL/TLS certificates via Let's Encrypt.
6. Update `APP_BASE_URL` on both Web and Worker services:
   ```bash
   APP_BASE_URL="https://booking.yourdomain.com"
   ```

---

## 9. Monitoring, Logs & Observability

### 9.1 Web Health Check
Verify your deployment with the built-in health endpoint:
```bash
curl -i https://booking.yourdomain.com/api/health
```
Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-11-06T22:00:00.000Z",
  "uptime": 1420,
  "database": {
    "status": "connected",
    "latencyMs": 14
  }
}
```

### 9.2 Viewing Live Logs
In Railway:
- **Web Logs**: Click **Slotbook Web** &rarr; **View Logs**. Shows HTTP request status, route compilation, and authentication events.
- **Worker Logs**: Click **Slotbook Worker** &rarr; **View Logs**. Shows due job claiming, email dispatch status, and correlation message IDs:
  ```text
  ==================================================
  ⚡ Slotbook Notification Background Worker
  ==================================================
  Environment:     production
  Provider:        resend
  Poll Interval:   5000ms
  Batch Size:      10
  Lock Lease:      300000ms
  Process PID:     1
  Worker listening for due notifications...

  [WORKER] Claimed 1 due notification job(s): [e2a4...d12]
  [WORKER] Successfully processed notification e2a4...d12 -> Status: SENT
  ```

---

## 10. Rollbacks & Disaster Recovery

### 10.1 Application Rollback
If a newly deployed web or worker commit causes issues:
1. In Railway, click the service &rarr; **Deployments**.
2. Locate the previous working deployment.
3. Click the `...` menu on that deployment &rarr; **Rollback**.
4. Railway instantly routes traffic back to the previous container image without rebuilding.

### 10.2 Database Backups
1. Open the **Postgres** service card in Railway.
2. Navigate to **Backups**.
3. Railway automatically maintains daily point-in-time snapshots.
4. You can click **Create Backup** prior to applying schema migrations.
5. To restore, select an existing backup snapshot and click **Restore**.

