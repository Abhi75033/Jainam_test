#!/bin/bash
# scripts/server-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
# ONE-TIME bootstrap for Amazon Linux 2023 EC2.
# Run as ec2-user. Idempotent — safe to re-run if interrupted.
#
# USAGE:
#   bash <(curl -fsSL https://raw.githubusercontent.com/Abhi75033/Jainam_test/main/scripts/server-setup.sh)

set -euo pipefail

step() { echo ""; echo "═══════════════════════════════════════"; echo "  ▶  $1"; echo "═══════════════════════════════════════"; }
ok()   { echo "  ✅ $1"; }

# ════════════════════════════════════════════════════════
# PHASE 1 — System Updates
# ════════════════════════════════════════════════════════
step "PHASE 1: System updates & core tools"
sudo dnf update -y --quiet
sudo dnf install -y git curl wget unzip htop tmux tree
ok "System packages installed"

# ════════════════════════════════════════════════════════
# PHASE 2 — Node.js 20 LTS
# WHY: Your package.json requires "node": ">=20.0.0"
# ════════════════════════════════════════════════════════
step "PHASE 2: Node.js 20 LTS"
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1)" != "v20" ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - --quiet
  sudo dnf install -y nodejs --quiet
fi
ok "Node.js: $(node --version)"
ok "npm: $(npm --version)"

# ════════════════════════════════════════════════════════
# PHASE 3 — Redis
# WHY: Your app uses Redis for OTP, sessions, BullMQ queues
# SECURITY: Bind to localhost only — never expose Redis publicly
# ════════════════════════════════════════════════════════
step "PHASE 3: Redis"
sudo dnf install -y redis6 --quiet
sudo systemctl enable redis6 --quiet
sudo systemctl start redis6

# Production Redis config — appended to existing config
if ! grep -q "JiNANAM Redis Config" /etc/redis6/redis6.conf 2>/dev/null; then
  sudo tee -a /etc/redis6/redis6.conf > /dev/null <<'REDIS_EOF'

# ─── JiNANAM Redis Config ───────────────────────────────────────
bind 127.0.0.1           # Localhost only — NEVER bind 0.0.0.0
protected-mode yes
maxmemory 256mb          # Prevent Redis from consuming all RAM
maxmemory-policy allkeys-lru  # Evict least-recently-used keys when full
save ""                  # Disable RDB snapshots (using Redis as cache only)
appendonly no            # AOF not needed for cache workload
tcp-keepalive 300        # Kill dead connections after 5 min
timeout 0
REDIS_EOF
  sudo systemctl restart redis6
fi

ok "Redis: $(redis6-cli ping)"

# ════════════════════════════════════════════════════════
# PHASE 4 — Nginx
# WHY: Reverse proxy — forwards ALB traffic to PM2 on :4000
#      Also handles gzip, security headers, keep-alive
# ════════════════════════════════════════════════════════
step "PHASE 4: Nginx"
sudo dnf install -y nginx --quiet
sudo systemctl enable nginx --quiet

# Write Nginx config
sudo tee /etc/nginx/conf.d/jinanam.conf > /dev/null <<'NGINX_EOF'
# ─── JiNANAM Nginx Config ──────────────────────────────────────────
# Handles: reverse proxy to PM2 :4000, gzip, security headers
# SSL is terminated at ALB — Nginx receives plain HTTP from ALB

# Upstream pool (PM2 cluster workers on same host)
upstream jinanam_api {
    server 127.0.0.1:4000;
    keepalive 64;           # Keep 64 persistent connections to Node.js
}

server {
    listen 80 default_server;
    server_name _;

    # ── Security Headers ────────────────────────────────────────────
    server_tokens off;                                    # Hide Nginx version
    add_header X-Frame-Options "DENY" always;             # Clickjacking protection
    add_header X-Content-Type-Options "nosniff" always;  # MIME sniffing protection
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # ── Gzip Compression ────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/json application/javascript application/xml+rss
        application/atom+xml image/svg+xml;

    # ── Client Settings ─────────────────────────────────────────────
    client_max_body_size 25M;     # Match Express: 5mb JSON + 20mb file uploads
    client_body_timeout 30s;
    client_header_timeout 30s;

    # ── Proxy to PM2 ────────────────────────────────────────────────
    location / {
        proxy_pass http://jinanam_api;
        proxy_http_version 1.1;

        # WebSocket support (required for socket.io)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Pass real client info to Express (trust proxy = 1 set in app.ts)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;

        # Cache bypass for API
        proxy_cache_bypass $http_upgrade;
    }

    # ── Health check — fast path ─────────────────────────────────────
    location = /health {
        proxy_pass http://jinanam_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;             # Don't log health check noise
    }

    # ── Block common attack paths ────────────────────────────────────
    location ~ /\.(git|env|htaccess|DS_Store) {
        deny all;
        return 404;
    }
}
NGINX_EOF

sudo nginx -t
sudo systemctl start nginx
ok "Nginx configured"

# ════════════════════════════════════════════════════════
# PHASE 5 — PM2 + pm2-logrotate
# WHY: PM2 cluster mode uses all CPU cores.
#      pm2-logrotate prevents log files from consuming disk.
#      pm2 startup ensures PM2 survives EC2 reboots.
# ════════════════════════════════════════════════════════
step "PHASE 5: PM2 global install"
sudo npm install -g pm2 --quiet

# Log rotation: 50MB max, keep 7 days, compress old logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# Systemd startup — survive reboots
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
ok "PM2 $(pm2 --version) installed with log rotation and startup"

# ════════════════════════════════════════════════════════
# PHASE 6 — Create directories
# ════════════════════════════════════════════════════════
step "PHASE 6: Directory structure"
mkdir -p /home/ec2-user/logs
mkdir -p /home/ec2-user/backups
ok "Directories created"

# ════════════════════════════════════════════════════════
# PHASE 7 — Clone Repository
# WHY: We clone the repo which contains ecosystem.config.js
#      and scripts/deploy.sh (all future deploys use deploy.sh)
# ════════════════════════════════════════════════════════
step "PHASE 7: Clone repository"
if [ ! -d "/home/ec2-user/Jainam_test/.git" ]; then
  git clone https://github.com/Abhi75033/Jainam_test.git /home/ec2-user/Jainam_test
  ok "Repository cloned"
else
  cd /home/ec2-user/Jainam_test
  git pull origin main
  ok "Repository updated"
fi

# Make deploy script executable
chmod +x /home/ec2-user/Jainam_test/scripts/deploy.sh

# ════════════════════════════════════════════════════════
# PHASE 8 — .env setup
# ════════════════════════════════════════════════════════
step "PHASE 8: Environment configuration"
ENV_FILE="/home/ec2-user/Jainam_test/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp /home/ec2-user/Jainam_test/.env.example "$ENV_FILE"
  echo ""
  echo "  ⚠️  IMPORTANT: Edit the .env file with production values!"
  echo "  Run: nano $ENV_FILE"
  echo ""
  echo "  Minimum required values:"
  echo "    DATABASE_URL  → RDS PostgreSQL connection string"
  echo "    REDIS_URL     → redis://localhost:6379"
  echo "    JWT_ACCESS_SECRET  → at least 64 random chars"
  echo "    JWT_REFRESH_SECRET → at least 64 random chars"
  echo "    QR_SIGNING_SECRET  → at least 32 random chars"
  echo "    FIELD_ENCRYPTION_KEY → 32-byte base64 key"
  echo "    NODE_ENV      → production"
  echo "    PORT          → 4000"
  echo ""
  echo "  Generate secrets:"
  echo "    node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
else
  ok ".env already exists"
fi

# ════════════════════════════════════════════════════════
# PHASE 9 — First Deploy
# ════════════════════════════════════════════════════════
step "PHASE 9: First deployment"
echo ""
echo "  After filling in .env, run:"
echo "    bash /home/ec2-user/Jainam_test/scripts/deploy.sh"
echo ""
echo "  Then verify:"
echo "    curl http://localhost:4000/health"
echo "    pm2 status"

# ════════════════════════════════════════════════════════
# PHASE 10 — Security Hardening
# ════════════════════════════════════════════════════════
step "PHASE 10: Security hardening"

# Fail2Ban — blocks IPs with too many SSH failures
sudo dnf install -y fail2ban --quiet
sudo systemctl enable fail2ban --quiet
sudo tee /etc/fail2ban/jail.local > /dev/null <<'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = systemd
FAIL2BAN
sudo systemctl start fail2ban
ok "Fail2Ban active"

# Automatic security updates
sudo dnf install -y dnf-automatic --quiet
sudo sed -i 's/^apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
sudo systemctl enable dnf-automatic.timer --quiet
sudo systemctl start dnf-automatic.timer
ok "Automatic security updates enabled"

# SSH hardening
sudo tee -a /etc/ssh/sshd_config.d/99-jinanam-hardening.conf > /dev/null <<'SSH_EOF'
# JiNANAM SSH Hardening
PermitRootLogin no
PasswordAuthentication no
ChallengeResponseAuthentication no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowTcpForwarding no
SSH_EOF
sudo systemctl reload sshd
ok "SSH hardened (no root, no password auth)"

step "SETUP COMPLETE!"
echo ""
echo "  Next steps:"
echo "  1. nano /home/ec2-user/Jainam_test/.env  (fill production values)"
echo "  2. bash /home/ec2-user/Jainam_test/scripts/deploy.sh"
echo "  3. curl http://localhost:4000/health"
echo "  4. Configure RDS (Phase 2)"
echo "  5. Configure ALB (Phase 3)"
echo ""
