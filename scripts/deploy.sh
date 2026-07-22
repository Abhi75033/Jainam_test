#!/bin/bash
# scripts/deploy.sh — Zero-Downtime Production Deploy Script
# ─────────────────────────────────────────────────────────────────────────────
# Runs ON the EC2 server, called by GitHub Actions via SSH.
# Never call `pm2 restart` — always use `pm2 reload` for zero-downtime.
#
# FLOW:
#   1. Snapshot current dist/ → backup (rollback target)
#   2. git pull latest code
#   3. npm ci (clean install, uses package-lock.json exactly)
#   4. prisma generate
#   5. prisma migrate deploy (safe: never drops data, only applies new migrations)
#   6. npm run build (TypeScript → dist/)
#   7. pm2 reload (zero-downtime: workers reloaded one at a time)
#   8. Health check (5 retries × 5s)
#   9. Rollback if health check fails

set -euo pipefail

APP_DIR="/home/ec2-user/Jainam_test"
LOG_FILE="/home/ec2-user/logs/deploy.log"
BACKUP_DIR="/home/ec2-user/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
HEALTH_URL="http://localhost:4000/health"

# ─── Helpers ────────────────────────────────────────────────────────────────
log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
ok()    { log "✅ $1"; }
fail()  { log "❌ $1"; }
step()  { log ""; log "── $1"; }

mkdir -p /home/ec2-user/logs "$BACKUP_DIR"

log ""
log "═══════════════════════════════════════════════════"
log "  🚀 JiNANAM Deploy — $TIMESTAMP"
log "═══════════════════════════════════════════════════"

# ─── Step 1: Rollback snapshot ───────────────────────────────────────────────
step "1/8 Creating rollback snapshot"
cd "$APP_DIR"
if [ -d "dist" ]; then
  cp -r dist "$BACKUP_DIR/dist_$TIMESTAMP"
  # Keep only last 3 backups to save disk space
  ls -dt "$BACKUP_DIR"/dist_* 2>/dev/null | tail -n +4 | xargs rm -rf || true
  ok "Snapshot saved: dist_$TIMESTAMP"
else
  log "⚠️  No dist/ found — first deploy, skipping snapshot"
fi

# ─── Step 2: Pull latest code ────────────────────────────────────────────────
step "2/8 Pulling latest code"
git fetch origin main --quiet
git reset --hard origin/main --quiet
COMMIT=$(git rev-parse --short HEAD)
ok "Code at commit: $COMMIT"

# ─── Step 3: Install dependencies ────────────────────────────────────────────
step "3/8 Installing dependencies"
# npm ci: clean install, respects package-lock.json exactly, faster than npm install
npm ci --prefer-offline --quiet
ok "Dependencies installed"

# ─── Step 4: Prisma generate ─────────────────────────────────────────────────
step "4/8 Generating Prisma client"
npx prisma generate --quiet 2>&1 | tail -3
ok "Prisma client generated"

# ─── Step 5: Run migrations ───────────────────────────────────────────────────
step "5/8 Applying database migrations"
# prisma migrate deploy: applies pending migrations without interactive prompts
# SAFE: never drops data, only runs forward migrations
npx prisma migrate deploy 2>&1
ok "Migrations applied"

# ─── Step 6: Build TypeScript ─────────────────────────────────────────────────
step "6/8 Building TypeScript"
npm run build 2>&1
ok "Build complete → dist/"

# ─── Step 7: PM2 reload (zero-downtime) ──────────────────────────────────────
step "7/8 Reloading PM2 (zero-downtime)"
# pm2 reload = rolling restart: one worker at a time, zero dropped requests
# --update-env: picks up any new .env values
pm2 reload ecosystem.config.js --env production --update-env 2>&1
pm2 save --force 2>&1
ok "PM2 reloaded"

# ─── Step 8: Health check ─────────────────────────────────────────────────────
step "8/8 Health check"
MAX_RETRIES=5
RETRY_DELAY=6

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" \
    --max-time 10 --connect-timeout 5 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    ok "Health check passed (HTTP $HTTP_CODE) on attempt $i"
    break
  fi

  log "⚠️  Attempt $i/$MAX_RETRIES failed (HTTP $HTTP_CODE) — retrying in ${RETRY_DELAY}s"
  sleep $RETRY_DELAY

  # ── ROLLBACK on final failure ─────────────────────────────────────────────
  if [ "$i" = "$MAX_RETRIES" ]; then
    fail "Health check failed after $MAX_RETRIES attempts — ROLLING BACK"

    LATEST_BACKUP=$(ls -dt "$BACKUP_DIR"/dist_* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
      log "🔄 Restoring: $LATEST_BACKUP"
      rm -rf "$APP_DIR/dist"
      cp -r "$LATEST_BACKUP" "$APP_DIR/dist"
      pm2 reload ecosystem.config.js --env production --update-env 2>&1
      pm2 save --force 2>&1
      log "⚠️  ROLLBACK COMPLETE — previous version restored"
    else
      fail "No backup available! Manual intervention required."
    fi

    log "════════════════════════════════════════"
    log "  DEPLOY FAILED  — commit: $COMMIT"
    log "════════════════════════════════════════"
    exit 1
  fi
done

# ─── Done ────────────────────────────────────────────────────────────────────
log ""
log "════════════════════════════════════════"
log "  🎉 DEPLOY SUCCEEDED — commit: $COMMIT"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "════════════════════════════════════════"
