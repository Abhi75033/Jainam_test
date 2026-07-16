<div align="center">

<br/>

```
   ██╗██╗███╗   ██╗ █████╗ ███╗   ██╗ █████╗ ███╗   ███╗
   ██║██║████╗  ██║██╔══██╗████╗  ██║██╔══██╗████╗ ████║
   ██║██║██╔██╗ ██║███████║██╔██╗ ██║███████║██╔████╔██║
██ ██║██║██║╚██╗██║██╔══██║██║╚██╗██║██╔══██║██║╚██╔╝██║
╚█████║██║██║ ╚████║██║  ██║██║ ╚████║██║  ██║██║ ╚═╝ ██║
 ╚════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝
```

# 🕉️ JiNANAM Platform — Backend

### *Connecting Jain Life* · Production-Grade REST API

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)

---

**Built with ❤️ by [Silver Wolf Technologies](https://www.silverwolftechnologies.in)**
*India's Premier Digital & Development Agency — 10+ Years · 22+ Cities · 50+ Retainers*

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Modules](#-modules--48-business-domains)
- [Key Flows](#-key-flows)
- [Security & Core Invariants](#-security--core-invariants)
- [API Reference](#-api-reference)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database & Migrations](#-database--migrations)
- [Background Jobs](#-background-jobs)
- [Realtime (Socket.IO)](#-realtime-socketio)
- [File Storage](#-file-storage)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Operations](#-operations)
- [Built By](#-built-by-silver-wolf-technologies)

---

## 🌐 Overview

**JiNANAM** *(जिनानाम — "Connecting Jain Life")* is a comprehensive, multi-tenant SaaS platform designed to digitise and unify the global Jain community ecosystem.

The platform serves as the central nervous system for:

| Domain | Scope |
|---|---|
| 🧘 **Monk Safety (MS) Tracking** | Real-time GPS tracking of Muni Maharaj & Sadhvijis |
| 🛕 **Temple (Derasar) Management** | Temple profiles, events, donations, visitor management |
| 🏨 **Dharamshala Bookings** | Full booking lifecycle with payment verification |
| 🎟️ **Paid Events & Ticketing** | Seat locking, QR tickets, check-in scanning |
| 👥 **Member & Family Registry** | Jain/Non-Jain members, auto family accounts |
| 🧭 **Yatra Tours (Tour Jatra)** | Daily counting, milestone certificates, route journeys |
| 💸 **Donations** | Split-category donations, 80G receipts, payment gateway |
| 📢 **Community Feed** | Smart ranked feed, announcements, polls, news |
| 🔔 **Notifications** | Multi-channel: Push, WhatsApp, SMS, Email, In-App |
| 📊 **Audit & Reports** | Immutable audit trail, PDF/Excel/CSV exports |

---

## 🛠 Tech Stack

### Core Runtime

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | `>=20.0.0` | JavaScript runtime (LTS) |
| **TypeScript** | `^5.6` | Strict-mode type safety across the entire codebase |
| **Express.js** | `^4.21` | HTTP framework — modular router-per-module structure |

### Database Layer

| Technology | Version | Purpose |
|---|---|---|
| **PostgreSQL** | `15+` | Primary relational database (100+ models) |
| **Prisma ORM** | `^5.20` | Type-safe DB client, migrations, schema management |
| **Redis** | `7` | OTP storage, BullMQ queues, rate limiting, seat locks |
| **ioredis** | `^5.4` | Production-grade Redis client with cluster support |

### Authentication & Security

| Technology | Purpose |
|---|---|
| **JWT** (`jsonwebtoken`) | Access + Rotating Refresh tokens |
| **bcryptjs** | Password hashing |
| **Zod** | Schema validation on every request (body/query/params) — 422 with field errors |
| **Helmet** | HTTP security headers |
| **express-rate-limit** | Redis-backed rate limiting (holds across scaled instances) |
| **AES-256-GCM** | Field-level encryption for Aadhaar, PAN, bank details |
| **HMAC-SHA256** | QR payload signing + Aadhaar de-duplication hash |

### Async & Realtime

| Technology | Purpose |
|---|---|
| **BullMQ** | Job queues — payment windows, event reminders, crons, seat releases |
| **Socket.IO** | Real-time namespaces: `/tracking`, `/dashboards`, `/visitors` |

### File, Export & Docs

| Technology | Purpose |
|---|---|
| **Multer** | File upload handling |
| **PDFKit** | Receipts, 80G certificates, tour certificates, QR tickets |
| **ExcelJS** | Excel report generation |
| **json2csv** | CSV export engine |
| **QRCode** | HMAC-signed QR code generation |
| **Swagger** (swagger-jsdoc + swagger-ui-express) | Auto-generated OpenAPI docs at `/api/docs` |

### Developer Experience

| Technology | Purpose |
|---|---|
| **tsx** | TypeScript execution with hot reload for development |
| **tsc + tsc-alias** | Production TypeScript compilation with path alias resolution |
| **Pino + pino-http** | Structured JSON logging |
| **Jest + Supertest** | Unit & end-to-end integration testing |
| **ESLint + Prettier** | Code quality & formatting |
| **Docker + Docker Compose** | Containerised local dev & production deployment |

---

## 🏗 Architecture

```
JINANAM_BACKEND/
├── src/
│   ├── config/           ← Env (Zod-validated), constants, Prisma, Redis, Logger, Swagger
│   ├── middlewares/      ← Auth → Permission → Org-scope → Validation → Rate-limit → Errors
│   ├── engines/          ← Shared cross-cutting services
│   │   ├── idGenerator/  ← Sequential public IDs (JFJT108...) — SELECT FOR UPDATE safe
│   │   ├── rbac/         ← JWT + configurable permission engine (role defaults + per-user/org overrides)
│   │   ├── visibility/   ← Community-chain + geo-expansion eligibility resolver
│   │   ├── notification/ ← Channel adapters (Push/WhatsApp/SMS/Email/In-App) + failover
│   │   ├── audit/        ← Immutable audit trail with before/after diffs
│   │   ├── qr/           ← HMAC-signed QR payloads (tickets, staff, visitor, certificates)
│   │   ├── currency/     ← Country → currency defaults
│   │   └── export/       ← One PDF/Excel/CSV service reused by every reports endpoint
│   ├── modules/          ← 48 business modules (routes / controller / service / dto)
│   ├── jobs/             ← BullMQ queues + worker bootstrap (runs as own process)
│   ├── sockets/          ← Socket.IO namespaces (auth-gated, org-scoped rooms)
│   ├── app.ts            ← Express app setup
│   └── server.ts         ← HTTP server bootstrap
├── prisma/
│   ├── schema.prisma     ← 100+ models, full relational schema
│   ├── migrations/       ← Version-controlled database migrations
│   └── seed.ts           ← Roles, master data (83 Gacchas), Super Admin, demo orgs
├── tests/
│   ├── unit/             ← Engine/utility tests (no DB required)
│   └── integration/      ← Full E2E suites (gated behind RUN_INTEGRATION=1)
├── Dockerfile            ← Multi-stage build (deps → build → runtime)
├── docker-compose.yml    ← API + Worker + PostgreSQL + Redis stack
└── .env.example          ← All configuration reference
```

### Middleware Pipeline

```
Request
  │
  ▼
[Helmet + CORS + Compression]
  │
  ▼
[pino-http Request Logger]
  │
  ▼
[Rate Limiter — Redis-backed]
  │
  ▼
[requireAuth] — JWT verification, attaches req.user
  │
  ▼
[requirePermission(module, action)] — RBAC engine check
  │
  ▼
[scopeToOrganization] — attaches req.organizationId, blocks cross-tenant access
  │
  ▼
[Zod Validation] — body/query/params → 422 on failure with field-level errors
  │
  ▼
[Controller → Service → Prisma]
  │
  ▼
[Global Audit Middleware] — records every successful authenticated mutation
  │
  ▼
Response
```

---

## 📦 Modules — 48 Business Domains

| # | Module | Description |
|---|---|---|
| 1 | **auth** | OTP login/register, JWT refresh, logout, device management |
| 2 | **members** | Jain/Non-Jain registration, profile, KYC, ID cards |
| 3 | **family** | Auto family accounts, relationships, family tree |
| 4 | **monks** | Monk/Sadhviji profiles, gaccha, paryushan |
| 5 | **temples** | Derasar profiles, management, trusts |
| 6 | **dharamshalas** | Lodging properties, room types, availability |
| 7 | **bookings** | Full booking lifecycle — submit → approve → pay → verify → receipt |
| 8 | **donations** | Category split, 80G receipts, payment gateway, analytics |
| 9 | **events** | Event creation, categories, capacity management |
| 10 | **tickets** | Paid event ticketing — seat lock → purchase → QR → check-in |
| 11 | **seating** | Seat map, lock management, real-time availability |
| 12 | **tracking** | Real-time monk GPS tracking, route history |
| 13 | **routesJourneys** | Predefined pilgrimage routes, waypoints |
| 14 | **tours99** | Yatra tour management, packages, pricing |
| 15 | **manualTracking** | Offline/manual monk tracking fallback |
| 16 | **visitors** | Visitor registration, offline sync (idempotent batch), vehicle dedup |
| 17 | **volunteers** | Volunteer registration, assignments, attendance |
| 18 | **staff** | Staff profiles, roles, document expiry tracking |
| 19 | **feed** | Smart ranked feed (followed → community → geo → global) + ads |
| 20 | **announcements** | Org-wide and community announcements |
| 21 | **news** | News articles, archival, categories |
| 22 | **polls** | Community polls, voting, results |
| 23 | **gallery** | Photo/video galleries, albums |
| 24 | **notifications** | Multi-channel delivery, logs, read receipts |
| 25 | **alerts** | Safety/emergency alerts, broadcast |
| 26 | **communication** | Org-to-org messaging, monk communication |
| 27 | **calendar** | Event calendar, tithi calendar integration |
| 28 | **jainCenters** | Jain centers directory, services |
| 29 | **chaturmas** | Chaturmas stay management, requests |
| 30 | **offers** | Community offers, discounts, expiry lifecycle |
| 31 | **ads** | Advertisement management, targeting, impressions |
| 32 | **banners** | Homepage/app banners, scheduling |
| 33 | **homeSections** | Dynamic home screen sections, ordering |
| 34 | **communityPages** | Static community pages, custom content |
| 35 | **masterData** | Gacchas (83), sub-sects, countries, categories (read-only) |
| 36 | **dashboard** | Admin dashboard stats, analytics, counters |
| 37 | **counters** | Real-time counters (members, visitors, tours) |
| 38 | **reports** | Export engine — PDF/Excel/CSV for all business data |
| 39 | **auditLogs** | Immutable audit trail viewer (Super Admin) |
| 40 | **settings** | Platform-wide and org-level settings |
| 41 | **subscriptionPlans** | Subscription tiers, features, billing |
| 42 | **devices** | Push token management, device registry |
| 43 | **search** | Global full-text search across members, temples, events |
| 44 | **faqs** | FAQ management by category |
| 45 | **feedback** | User feedback, ratings, suggestions |
| 46 | **incorrectReports** | Data accuracy reporting, review workflow |
| 47 | **ticketsSupport** | Customer support ticket system |
| 48 | **uploads** | File upload orchestration, storage abstraction |

---

## 🔄 Key Flows

### 🔐 Authentication Flow
```
Mobile Number → POST /auth/otp/request   (Redis stores OTP, TTL 5 min)
             → POST /auth/otp/verify     (validates, returns access + refresh JWT)
             → POST /auth/refresh        (rotating refresh token)
             → POST /auth/logout         (revokes refresh token)
```

### 📅 Booking Lifecycle
```
POST /bookings  (submit)
  → Org Admin: approve / reject
  → [APPROVED] BullMQ payment-window timer starts
  → User: uploads payment proof
  → Org Admin: verifies payment
  → [VERIFIED] PDFKit generates receipt PDF
  → Notification sent (WhatsApp → SMS fallback)
```

### 🎟️ Paid Event Ticketing
```
Super Admin creates Event + ticket categories
  → User selects seats → Redis seat-lock (TTL)
  → POST /tickets/purchase (idempotent, payment gateway)
  → [SUCCESS] QR-signed ticket PDF generated
  → Scanner: POST /tickets/scan (validates HMAC, marks used, rejects duplicates)
```

### 🧭 Tour Jatra Counting
```
Daily monk count POST /tracking/manual
  → Auto-cumulative counters updated
  → Milestone checks: 25% / 50% / 75% / 100%
  → [MILESTONE] PDFKit + QRCode certificate generated
  → Push + WhatsApp notification dispatched
```

### 📡 Smart Feed Algorithm
```
GET /feed
  ├── Followed organizations / monks   (priority tier 1)
  ├── Same community chain             (tier 2)
  ├── Geo-expansion rings              (tier 3)
  ├── Global / platform-wide           (tier 4)
  └── Ads interleaved at configured intervals
```

### 💸 Donation with 80G Receipt
```
POST /donations  (categories + amounts — split validated)
  → Payment gateway verification
  → [VERIFIED] 80G receipt PDF generated (PAN/trust details)
  → Sent via WhatsApp / Email
```

---

## 🔒 Security & Core Invariants

> These rules are enforced at the code/middleware level — not just convention.

| Invariant | Implementation |
|---|---|
| **Multi-tenant isolation** | Every org-scoped route passes `scopeToOrganization`; services filter by `organizationId`. Org admins cannot touch another org's data. |
| **Soft deletes only** | DELETE is Super Admin only. All records use `deletedAt` + `deletedBy` — no hard-delete path exists in the API. |
| **Immutable public IDs** | System-generated, sequential from `108`, immutable, never reused — concurrency-safe via `SELECT FOR UPDATE` on `id_sequences`. |
| **Paid events — Super Admin only** | Org admins receive a blocking 403 directing them to `PAID_EVENT_REQUEST` support-ticket flow. |
| **Permanent retention** | Audit logs, bookings history, event archives, visitor logs, tour history — never purged. |
| **Field-level encryption** | Aadhaar, PAN, bank details, govt doc numbers → AES-256-GCM encrypted at rest. |
| **Aadhaar deduplication** | HMAC lookup hash stored separately — prevents duplicates without decrypting raw value. |
| **Blanket audit net** | Global middleware records every successful authenticated mutation (sensitive fields redacted) + explicit before/after diffs on critical actions. |
| **Redis-backed rate limiting** | Limits are consistent across horizontally scaled instances. |
| **Notification failover** | WhatsApp delivery failure automatically retries via SMS. All attempts logged in `notification_logs`. |

---

## 📡 API Reference

| Endpoint | Description |
|---|---|
| `GET /health` | Health check — uptime, DB, Redis status |
| `GET /api/docs` | Interactive Swagger UI (auto-generated from live router) |
| `GET /api/v1/*` | All versioned REST API endpoints |
| `WS /tracking` | Socket.IO — real-time monk GPS (auth-gated, org-scoped) |
| `WS /dashboards` | Socket.IO — live dashboard counters |
| `WS /visitors` | Socket.IO — real-time visitor check-in events |

### Default Ports

| Service | Port |
|---|---|
| API Server | `4000` |
| PostgreSQL | `5432` |
| Redis | `6379` |

---

## 🚀 Quick Start

### Option 1 — Docker (Recommended)

```bash
# 1. Clone and configure
git clone https://github.com/YOUR_ORG/jinanam-backend.git
cd jinanam-backend
cp .env.example .env          # Fill in secrets (defaults work for local Docker)

# 2. Start the full stack (API + Worker + PostgreSQL + Redis)
#    Migrations run automatically on startup
docker-compose up

# 3. Seed master data, roles, Super Admin, demo org
docker-compose exec api npx tsx prisma/seed.ts
```

**Access Points:**

| URL | Description |
|---|---|
| `http://localhost:4000/api/v1` | REST API base URL |
| `http://localhost:4000/api/docs` | Swagger UI |
| `http://localhost:4000/health` | Health check |

**Seeded Super Admin credentials:**
```
Mobile:   +919999900000
Password: ChangeMe@108   ← Rotate immediately!
```

---

### Option 2 — Local Development (No Docker)

```bash
# Prerequisites: Node.js 20+, PostgreSQL 15+, Redis 7
npm install

# Run DB migrations and seed
npx prisma migrate deploy
npm run seed

# Start API (hot reload)
npm run dev

# Start BullMQ Worker (separate terminal)
npm run worker
```

---

## ⚙️ Environment Variables

All configuration is validated at boot via Zod — the process exits with a field-level error report if any required variable is missing or invalid.

```env
# ── App ───────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000
API_BASE_PATH=/api/v1
APP_NAME=JiNANAM

# ── Database ──────────────────────────────────────────────────────────
DATABASE_URL=postgresql://jinanam:jinanam@localhost:5432/jinanam?schema=public

# ── Redis ─────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── JWT ───────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ── OTP ───────────────────────────────────────────────────────────────
OTP_LENGTH=6
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=30

# ── Security ──────────────────────────────────────────────────────────
QR_SIGNING_SECRET=<strong-hmac-secret>
FIELD_ENCRYPTION_KEY=<32-byte-base64-key>

# ── Storage ───────────────────────────────────────────────────────────
STORAGE_DRIVER=local                      # or "s3"
STORAGE_LOCAL_ROOT=./storage/uploads
STORAGE_PUBLIC_BASE_URL=http://localhost:4000/static
S3_ENDPOINT=
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# ── Notifications ─────────────────────────────────────────────────────
FCM_SERVER_KEY=
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
SMS_API_URL=
SMS_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@jinanam.app

# ── Payment Gateway ───────────────────────────────────────────────────
PAYMENT_GATEWAY_KEY_ID=
PAYMENT_GATEWAY_KEY_SECRET=
PAYMENT_GATEWAY_WEBHOOK_SECRET=

# ── Rate Limiting ─────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
OTP_RATE_LIMIT_MAX=5

# ── CORS ──────────────────────────────────────────────────────────────
CORS_ORIGIN=https://your-frontend-domain.com
```

> See [`.env.example`](.env.example) for the full reference file.

---

## 🗄 Database & Migrations

```bash
# Generate Prisma client after schema changes
npm run prisma:generate

# Create a new migration (development)
npm run prisma:migrate

# Apply migrations (production / CI)
npm run prisma:migrate:deploy

# Open Prisma Studio (visual DB browser)
npm run prisma:studio

# Seed master data
npm run seed
```

**Schema highlights:**
- **100+ models** covering all 48 business modules
- **Soft deletes** (`deletedAt`, `deletedBy`) on all entity tables
- **Audit fields** (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`) everywhere
- **AES-256-GCM encrypted columns** for Aadhaar, PAN, bank details
- **83 Gacchas** seeded as immutable master data
- **id_sequences** table for concurrency-safe sequential public ID generation

---

## ⚡ Background Jobs (BullMQ)

All queues run in a dedicated **worker process** (`npm run worker` / `node dist/src/jobs/worker.js`).

| Queue | Trigger | Action |
|---|---|---|
| `payment-window` | Booking approval | Starts countdown timer, expires unpaid bookings |
| `event-lifecycle` | Event creation/update | Reminder notifications before event start |
| `seat-lock-release` | Seat reservation TTL | Releases expired seat holds |
| `offer-expiry` | Offer creation | Archives expired offers |
| `news-archival` | Scheduled cron | Archives stale news articles |
| `tithi-notifications` | Daily cron | Sends Jain calendar/tithi notifications |
| `device-alert-sweep` | Scheduled cron | Cleans up stale push tokens |
| `tour-certificates` | Milestone reached | Generates and delivers tour certificates |
| `page-subscription-recompute` | Content change | Recalculates community page subscriptions |
| `feed-activation` | Content scheduling | Activates/deactivates scheduled feed items |
| `staff-doc-expiry` | Daily cron | Alerts on expiring staff documents |

---

## 🔴 Realtime (Socket.IO)

Three authenticated, org-scoped Socket.IO namespaces:

```
/tracking    ← Real-time monk GPS coordinates & route updates
/dashboards  ← Live admin dashboard counters (members, visitors, donations)
/visitors    ← Instant visitor check-in/check-out events
```

> For multi-instance Socket.IO, add `@socket.io/redis-adapter` to the production setup.

---

## 🗂 File Storage

The storage layer is abstracted — swap drivers via environment config:

| Driver | Config | Use Case |
|---|---|---|
| `local` | `STORAGE_LOCAL_ROOT` | Development, single-server deployments |
| `s3` | `S3_*` env vars | Production — AWS S3, Cloudflare R2, MinIO |

Files are served at `STORAGE_PUBLIC_BASE_URL` (local) or direct CDN URL (S3).

---

## 🧪 Testing

```bash
# Unit tests — no database required
npm run test:unit

# All tests
npm test

# Integration tests (requires live PostgreSQL + Redis)
RUN_INTEGRATION=1 npm test

# Watch mode (development)
npm run test:watch

# Coverage report
npm run test:coverage
```

**Integration test suites cover:**

| Suite | Scenario |
|---|---|
| Booking flow | submit → approve → payment window → verify → receipt PDF |
| Donation | split validation → gateway verify → 80G receipt |
| Paid event | seat lock → purchase → QR ticket → scan → duplicate rejection |
| Visitor sync | offline batch with idempotency keys + vehicle deduplication |
| Tour jatra | daily count → cumulative → milestones → certificate |
| Member registration | Jain/Non-Jain → family auto-account → ID sequence |
| Cross-tenant isolation | org A cannot access org B data |

---

## 🚢 Deployment

### Docker (Production)

```bash
# Build production image
docker build -t jinanam-backend:latest .

# Run with environment variables
docker run -d \
  --name jinanam-api \
  -p 4000:4000 \
  --env-file .env.production \
  jinanam-backend:latest
```

### Railway (Recommended Free Tier)

1. Push your repo to GitHub
2. Create new Railway project → **Deploy from GitHub repo**
3. Add **PostgreSQL** plugin → use `${{Postgres.DATABASE_URL}}`
4. Add **Redis** plugin → use `${{Redis.REDIS_URL}}`
5. Set all environment variables in Railway **Variables** tab
6. Run migrations via Railway Shell: `npx prisma migrate deploy`
7. Add second service for the **worker**: start command `node dist/src/jobs/worker.js`
8. Generate a public domain from **Settings → Generate Domain**

### Scaling Notes

- **API is stateless** — scale horizontally behind a load balancer
- **Worker process** — run 1+ dedicated worker instances
- **Rate limiting** is Redis-backed — consistent across all instances
- **Socket.IO** — add `@socket.io/redis-adapter` for multi-instance deployments

---

## 🔧 Operations

| Task | Command / Action |
|---|---|
| **Database backup** | `pg_dump jinanam > backup_$(date +%Y%m%d).sql` (nightly cron) |
| **Redis** | Reconstructable (OTPs/locks/queues) — AOF optional |
| **View logs** | `docker-compose logs -f api` |
| **Prisma Studio** | `npm run prisma:studio` → `http://localhost:5555` |
| **View API docs** | `http://localhost:4000/api/docs` |
| **Health check** | `curl http://localhost:4000/health` |
| **Re-run seed** | `docker-compose exec api npx tsx prisma/seed.ts` |

---

## 📜 Scripts Reference

```bash
npm run dev                    # Start API with hot reload (tsx watch)
npm run worker                 # Start BullMQ worker with hot reload
npm run build                  # Compile TypeScript to dist/
npm run start                  # Start compiled production API
npm run start:worker           # Start compiled production worker
npm run prisma:generate        # Re-generate Prisma client
npm run prisma:migrate         # Create new migration (dev)
npm run prisma:migrate:deploy  # Apply migrations (production)
npm run prisma:studio          # Open Prisma Studio
npm run seed                   # Run database seed script
npm run lint                   # Lint TypeScript files
npm run lint:fix               # Auto-fix lint errors
npm run format                 # Format code with Prettier
npm run test                   # Run all tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests (requires DB)
npm run test:coverage          # Generate coverage report
```

---

## 🏢 Built By Silver Wolf Technologies

<div align="center">

```
 ╔══════════════════════════════════════════════════════════╗
 ║                                                          ║
 ║      🐺  SILVER WOLF TECHNOLOGIES                        ║
 ║                                                          ║
 ║      India's Premier Digital & Development Agency        ║
 ║      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         ║
 ║                                                          ║
 ║      10+ Years of Excellence                             ║
 ║      15+ Service Verticals                               ║
 ║      22+ Cities Served                                   ║
 ║      50+ Active Retainers                                ║
 ║      4.9★ Client Rating                                  ║
 ║      3.4× Average ROI within 90 days                     ║
 ║                                                          ║
 ╚══════════════════════════════════════════════════════════╝
```

</div>

**Silver Wolf Technologies** is a full-service senior digital agency with 10+ years of experience building high-performance websites, mobile apps, CRMs, SaaS platforms, and executing SEO & digital marketing campaigns for startups, SMBs, and global enterprises across India and worldwide.

### What We Build

| Service | Description |
|---|---|
| 🌐 **Website Development** | Custom business websites, enterprise web apps — React, Next.js, Node.js |
| 🛒 **E-commerce Development** | Shopify, WooCommerce, headless commerce stores built to convert |
| 📱 **Mobile App Development** | Native iOS, Android and cross-platform Flutter / React Native apps |
| 🗃️ **CRM Development** | Custom CRMs, HR portals, attendance systems, workflow automation |
| 🚀 **SaaS & Web Apps** | Enterprise SaaS, LMS, multi-tenant platforms — engineered to scale |
| 📈 **SEO Services** | Technical, on-page and off-page SEO for India and global markets |
| 📣 **Digital Marketing** | Performance ads, social, content marketing with measurable ROI |
| 🎨 **UI/UX Design** | Research-driven interfaces that convert visitors into customers |
| 🎬 **Video & Photo Editing** | YouTube, reels, corporate edits with cinematic motion design |

### Connect With Us

| Channel | Link |
|---|---|
| 🌐 **Website** | [www.silverwolftechnologies.in](https://www.silverwolftechnologies.in) |
| 📧 **Email** | [info@silverwolftechnologies.in](mailto:info@silverwolftechnologies.in) |
| 📞 **Phone** | [+91-9316028350](tel:+919316028350) |
| 💼 **LinkedIn** | [linkedin.com/company/silver-wolf-technologies](https://www.linkedin.com/company/silver-wolf-technologies) |
| 📸 **Instagram** | [@silverwolftechnologies](https://www.instagram.com/silverwolftechnologies) |
| 📍 **Location** | Murbad, Maharashtra, India — 421401 |

> *"We move like a pack. You scale like a leader."*
> — Silver Wolf Technologies

---

<div align="center">

**JiNANAM Platform Backend** · Built with ❤️ by [Silver Wolf Technologies](https://www.silverwolftechnologies.in)

*Connecting Jain Life — Digitally, Globally, Securely* 🕉️

</div>
# Jainam_test
