#!/bin/bash
# scripts/generate-secrets.sh
# ─────────────────────────────────────────────────────────────────────────────
# Generates all required production secrets for JiNANAM .env
# Run this ONCE locally, then paste values into your EC2 .env
# NEVER commit these values to git.
#
# Usage:
#   bash scripts/generate-secrets.sh

echo ""
echo "═══════════════════════════════════════════════"
echo "  JiNANAM — Production Secrets Generator"
echo "═══════════════════════════════════════════════"
echo ""
echo "Copy these values into your EC2 .env file:"
echo ""

JWT_ACCESS=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
QR_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
FIELD_ENC=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

echo "# ─── Secrets (generated $(date '+%Y-%m-%d')) ───"
echo "NODE_ENV=production"
echo "PORT=4000"
echo ""
echo "# Generate your RDS connection string from AWS Console:"
echo "DATABASE_URL=postgresql://jinanam_admin:YOUR_RDS_PASSWORD@YOUR_RDS_ENDPOINT:5432/jinanam_prod?schema=public&sslmode=require&connection_limit=10"
echo ""
echo "REDIS_URL=redis://localhost:6379"
echo ""
echo "JWT_ACCESS_SECRET=$JWT_ACCESS"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH"
echo "JWT_ACCESS_TTL=15m"
echo "JWT_REFRESH_TTL=30d"
echo ""
echo "QR_SIGNING_SECRET=$QR_SECRET"
echo "FIELD_ENCRYPTION_KEY=$FIELD_ENC"
echo ""
echo "# ─── App URLs ───────────────────────────────────"
echo "STORAGE_DRIVER=local"
echo "STORAGE_LOCAL_ROOT=./storage/uploads"
echo "STORAGE_PUBLIC_BASE_URL=https://api.jinanam.org/static"
echo "CORS_ORIGIN=https://jinanam.org,https://www.jinanam.org,https://app.jinanam.org"
echo ""
echo "# ─── Fill in remaining optional values manually ─"
echo "FCM_SERVER_KEY="
echo "WHATSAPP_API_URL="
echo "WHATSAPP_API_TOKEN="
echo "SMS_API_URL="
echo "SMS_API_KEY="
echo "SMTP_HOST="
echo "SMTP_PORT=587"
echo "SMTP_USER="
echo "SMTP_PASS="
echo "SMTP_FROM=no-reply@jinanam.org"
echo "PAYMENT_GATEWAY_KEY_ID="
echo "PAYMENT_GATEWAY_KEY_SECRET="
echo "PAYMENT_GATEWAY_WEBHOOK_SECRET="
echo "RATE_LIMIT_WINDOW_MS=60000"
echo "RATE_LIMIT_MAX=120"
echo "OTP_RATE_LIMIT_MAX=5"
echo ""
echo "═══════════════════════════════════════════════"
echo "⚠️  DO NOT commit these secrets to git!"
echo "   Store them in AWS Secrets Manager for production."
echo "═══════════════════════════════════════════════"
