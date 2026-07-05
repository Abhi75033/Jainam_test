# DECISIONS.md — JiNANAM Backend

Records of spec ambiguities/conflicts and the interpretation implemented, per the
master prompt's instruction to "choose the most robust interpretation, implement
it, and record the decision."

---

## D-001 — Public ID prefix scheme: `JT/JMS/JJM` (older PRD) vs `JF*` (refined spec)

**Decision:** Implemented the refined **`JF*`** scheme, per the master prompt's
explicit instruction ("Implement `JF*`").

Prefixes live in a single constants file — [src/config/constants.ts](src/config/constants.ts)
`ID_PREFIXES` — so switching or extending schemes never requires touching the
engine or call sites. Additional internal prefixes not enumerated in the spec
(bookings `JFBK`, donations `JFDN`, receipts `JFRC`, events `JFEV`, tickets
`JFTK`, visitor entries `JFVE`, tours `JFTR`, support tickets `JFSU`, devices
`JFDV`, offers `JFOF`, news `JFNW`) follow the same convention.

## D-002 — Geo queries: PostGIS/earthdistance vs plain lat/lng + Haversine

**Decision:** Plain indexed `lat`/`lng` double columns with the **Haversine
formula computed in SQL** (and in-process for small candidate sets in the feed
ranker). Avoids a hard dependency on Postgres extensions, which keeps
`docker-compose up` + managed-Postgres deployments (RDS, Cloud SQL, Neon)
working with zero extension provisioning. If scale later demands it, swapping
to PostGIS is an additive migration (new column + index), not a redesign.

## D-003 — The "83 Gaccha" master list contents

**Decision:** The spec mandates an 83-item Gaccha list but does not enumerate
it. The seed inserts the well-known Gaccha names available and pads to exactly
83 with clearly-labelled placeholder rows (`Gaccha N`). All rows are ordinary
Super-Admin-editable master data — the client team can rename/replace them via
the master-data API without code changes. Nothing in application logic depends
on specific Gaccha names.

## D-004 — Event archive retention: 5 years vs 25 years (client states both)

**Decision:** **Permanent retention** (the strictly more robust superset of
both). Past events are browsable by org → year → month indefinitely; nothing
auto-purges. If a retention window is later mandated, it can be added as a
scheduled archival job without data loss today.

## D-005 — Admin portal: web vs mobile+web

**Decision:** Backend is transport-agnostic REST + Socket.IO; every admin
capability is exposed as API endpoints consumable by web, mobile, or both.
Device metadata capture (`deviceType: ANDROID | IOS | WEB`) already supports
all three. No decision is forced on the client layer.

## D-006 — OTP delivery in development

OTPs are stored in Redis and, **only when `NODE_ENV !== 'production'`**, echoed
in the API response (`devOtp`) so local testing works without SMS credentials.
In production the field is omitted and delivery happens via the notification
engine (WhatsApp → SMS failover).

## D-007 — Payment gateway integration

The spec requires gateway payments for platform donations and event tickets but
names no provider. Implemented as **payment-reference acceptance**: the client
completes gateway checkout and posts the gateway reference
(`paymentGatewayRef` / `paymentRef`) with an idempotency key. The
webhook-verification step is stubbed behind env vars
(`PAYMENT_GATEWAY_*`) — wiring an actual provider (Razorpay/Stripe) touches
only the donations/tickets services, not their consumers.

## D-008 — Seat lock TTL

Spec mandates Redis TTL seat locks but no duration. Implemented **8 minutes**
(BookMyShow-style checkout window), defined as a constant in
[seating.service.ts](src/modules/seating/seating.service.ts).

## D-009 — Suspicious-login heuristics

Spec says "flag suspicious activity (multiple devices, repeated failed logins)"
without thresholds. Implemented: **> 3 distinct devices active within 24h** or
**≥ 5 failed logins within 24h** flags the login row for Super Admin review.
Thresholds are constants in [auth.service.ts](src/modules/auth/auth.service.ts).

## D-010 — Counter milestone step

"Milestone notifications (e.g., 1000 counts)" — implemented at every 1000-count
boundary crossing. Tour milestones are fixed by spec at 25/50/75/100%.

## D-011 — News restore restarts the 7-day clock

Spec says archived news can be restored by Super Admin but not what happens to
its lifetime. Implemented: restore re-publishes (resets `publishedAt`) and
schedules a fresh 7-day auto-archive job.

## D-012 — BullMQ Redis connections

BullMQ pins its own `ioredis` version, which conflicts at the type level with
the project's top-level `ioredis`. Queues/workers therefore receive **plain
connection options** (host/port/auth parsed from `REDIS_URL`) rather than a
shared client instance — also BullMQ's own recommendation.

## D-013 — Geofence notification dedupe

"Push when a member is within 5 km radius of a temple" would re-fire on every
location ping while inside the radius. Implemented a **6-hour Redis dedupe key
per (member, temple)** so members get at most one nearby-temple push per temple
per 6 hours.
