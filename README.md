# JiNANAM Platform Backend

Production-grade backend for **JiNANAM** ("Connecting Jain Life") — a
multi-tenant Jain community platform covering monk (MS) safety tracking, temple
(Derasar) coordination, dharamshala bookings, donations, events with paid
ticketing, community feed, visitor management, staff management, yatra tours,
and more.

## Tech Stack

- **Runtime:** Node.js 20+ (TypeScript, strict mode)
- **Framework:** Express.js — modular router-per-module structure
- **Database:** PostgreSQL 15+ via **Prisma** (full schema in `prisma/schema.prisma`)
- **Auth:** JWT (access + rotating refresh) + OTP login (Redis-backed)
- **Validation:** Zod on every request (body/query/params) → 422 with field errors
- **Jobs:** BullMQ + Redis (payment windows, event lifecycle/reminders, offers, news archival, tithi notifications, device alert sweeps, seat-lock releases, tour certificates)
- **Realtime:** Socket.IO namespaces `/tracking`, `/dashboards`, `/visitors`
- **Files:** storage abstraction (local disk in dev, S3-compatible interface)
- **PDF/exports:** pdfkit (receipts, certificates), exceljs, json2csv — common export engine
- **Docs:** Swagger at `/api/docs`
- **Tests:** Jest + Supertest

## Quick Start

```bash
cp .env.example .env          # fill secrets (defaults work for docker-compose)
docker-compose up             # boots API (:4000) + worker + Postgres + Redis,
                              # runs migrations automatically
```

Then seed roles, master data (incl. the 83-Gaccha list), the Super Admin, and
demo organizations/members:

```bash
docker-compose exec api npx tsx prisma/seed.ts
```

- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/api/docs
- Health: http://localhost:4000/health
- Seeded Super Admin: mobile `+919999900000`, password `ChangeMe@108` (rotate immediately)

### Local development (no Docker)

```bash
npm install
npx prisma migrate deploy && npm run seed
npm run dev        # API with hot reload
npm run worker     # BullMQ worker process (separate terminal)
```

### Tests

```bash
npm run test:unit            # engine/unit tests (no DB required)
RUN_INTEGRATION=1 npm test   # + full end-to-end flow tests (needs live Postgres + Redis,
                             #   i.e. docker-compose up postgres redis)
```

End-to-end suites (Supertest against the real app + middleware chain):
booking→payment window→verify→receipt, donation split validation→receipt,
paid event→seat lock→ticket→QR scan→duplicate rejection, visitor offline-sync
idempotency + vehicle duplicate prevention, tour jatra counting→milestones→
certificate, member registration→family auto-account, ID-sequence concurrency,
and cross-tenant isolation.

## Architecture

```
src/
  config/         env (zod-validated), constants (ID prefixes, roles, modules), prisma, redis, logger, swagger
  middlewares/    requireAuth → requirePermission(module, action) → scopeToOrganization; validation; rate limits; errors
  engines/        shared cross-cutting services
    idGenerator/  sequential immutable public IDs (JFJT108...), id_sequences + SELECT FOR UPDATE
    rbac/         JWT + configurable permission engine (role defaults + per-user/per-org overrides)
    visibility/   community-chain + geo-expansion eligibility resolver (feed/events/offers/announcements)
    notification/ channel adapters (Push/WhatsApp/SMS/Email/In-App) + WhatsApp→SMS failover + BullMQ fan-out
    audit/        immutable audit trail with before/after diffs
    qr/           HMAC-signed QR payloads (tickets, staff identity, visitor check-in, certificates)
    currency/     country → currency defaults (suggest-not-force on change)
    export/       one PDF/Excel/CSV service reused by every reports endpoint
  modules/        one folder per business module (routes / controller / service / dto)
  jobs/           BullMQ queues + worker bootstrap (run as its own process)
  sockets/        Socket.IO namespaces (auth-gated, org-scoped rooms)
prisma/           schema (100+ models), migrations, seed
tests/            unit + integration (integration gated behind RUN_INTEGRATION=1)
```

### Core invariants (enforced in code)

- **Tenant isolation:** every org-scoped route passes `scopeToOrganization`;
  services filter by `organizationId`. Org admins can never touch another
  org's data (exceptions per spec: shared monk profiles, org-to-org chat).
- **DELETE is Super Admin only, everywhere.** Soft delete (`deletedAt`,
  `deletedBy`) globally; the API has no hard-delete path.
- **Public IDs** are system-generated, sequential from 108, immutable, never
  reused — concurrency-safe via row-locked `id_sequences`.
- **Paid events are Super Admin only** — org admins receive a blocking message
  directing them to the PAID_EVENT_REQUEST support-ticket flow.
- **Permanent retention:** audit logs, bookings history, event archives, tour
  history/communications, visitor logs are never purged.
- **Sensitive fields** (Aadhaar, PAN, bank details, govt doc numbers) are
  AES-256-GCM encrypted at rest; Aadhaar duplicate-prevention uses an HMAC
  lookup hash.
- **Blanket audit net:** a global middleware records every successful
  authenticated mutation (redacting sensitive body fields) on top of the
  explicit before/after audits on critical actions.
- **Recurring jobs** (tithi daily, device sweeps, page-subscription
  recompute, feed activation, staff doc-expiry/not-checked-out sweeps) are
  registered as BullMQ repeatable crons on worker startup.
- **Rate limiting is Redis-backed** so limits hold across scaled instances.
- **Swagger** documents every registered route automatically — the OpenAPI
  paths are generated from the live router at startup.

### Key flows

| Flow | Path |
|---|---|
| OTP login/registration | `POST /auth/otp/request` → `POST /auth/otp/verify` |
| Member registration | `POST /members/register/jain` / `register/non-jain` |
| Family auto-account | `POST /family` (auto-creates Inactive member + SMS link) |
| Booking lifecycle | submit → approve → payment window (BullMQ timer) → proof upload → verify → receipt PDF |
| Manual donation | split-validated categories → verify → 80G receipt PDF |
| Paid event | Super Admin event + ticket categories → seat lock (Redis TTL) → purchase (idempotent) → QR ticket → scanner check-in with duplicate rejection |
| Visitor offline sync | `POST /visitors/sync` (idempotency keys, batch) |
| Tour jatra counting | daily counts → auto cumulative → 25/50/75/100% milestones → certificate PDF+QR |
| Smart feed | `GET /feed` — followed > community > geo rings > global, ads interleaved |

See [DECISIONS.md](DECISIONS.md) for recorded spec-ambiguity resolutions.

## Environment

All configuration is via `.env` (validated at boot — the process exits with a
field-level report if invalid). See [.env.example](.env.example) for the full
list: database/redis URLs, JWT secrets, OTP tuning, QR/field-encryption keys,
storage driver, notification provider creds (optional in dev — adapters no-op
log), payment gateway keys, rate limits.

## Operations notes

- **Backups:** run nightly `pg_dump` against the `jinanam` database; Redis is
  reconstructable (OTPs/locks/queues) and needs no backup beyond AOF if desired.
- **Scaling:** the API is stateless — scale horizontally behind a load
  balancer; run one or more dedicated worker processes (`npm run worker`);
  Socket.IO needs the Redis adapter when going multi-instance (add
  `@socket.io/redis-adapter` at that point).
- **Reliability:** WhatsApp delivery failures automatically fail over to SMS;
  notification attempts are logged per-channel in `notification_logs`
  (sent/opened analytics).
