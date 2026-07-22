// ecosystem.config.js — PM2 Production Configuration
// ─────────────────────────────────────────────────────────────────────────────
// WHY CLUSTER MODE: t3.small has 2 vCPU. Running `instances: 'max'` creates 2
// workers. Zero-downtime reloads work by taking workers offline one-at-a-time.
//
// WHY pm2 reload (NOT pm2 restart):
//   restart = kill all → start all (downtime gap)
//   reload  = start new → wait ready → kill old (zero downtime)
//
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 reload ecosystem.config.js --env production --update-env
//   pm2 save

module.exports = {
  apps: [
    // ─── Main API Server ────────────────────────────────────────────────────
    {
      name: 'jinanam-backend',
      script: 'dist/src/server.js',

      // Cluster mode: one process per CPU core
      instances: 'max',
      exec_mode: 'cluster',

      // Crash recovery
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',           // Must stay up 10s to count as successful start
      restart_delay: 4000,         // Wait 4s between restart attempts

      // Graceful shutdown — server.ts has SIGTERM handler that drains connections
      kill_timeout: 10000,         // Give app 10s to finish in-flight requests
      wait_ready: false,           // server.ts doesn't call process.send('ready')
      listen_timeout: 15000,       // Max time to wait for process to be ready

      // Memory guard — restart if process leaks past this
      max_memory_restart: '512M',

      // Production environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      // Logs — rotated by pm2-logrotate module
      out_file: '/home/ec2-user/logs/jinanam-out.log',
      error_file: '/home/ec2-user/logs/jinanam-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // V8 memory limit: keep below max_memory_restart to avoid OOM kills
      node_args: ['--max-old-space-size=450'],
    },

    // ─── BullMQ Background Worker ───────────────────────────────────────────
    // WHY fork mode: BullMQ workers must not be clustered (race conditions on
    // job processing). Each worker should run in a single process.
    {
      name: 'jinanam-worker',
      script: 'dist/src/jobs/worker.js',
      instances: 1,
      exec_mode: 'fork',           // NOT cluster — BullMQ requires fork mode

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 30000,         // Give worker 30s to finish processing active jobs
      max_memory_restart: '256M',

      env_production: {
        NODE_ENV: 'production',
      },

      out_file: '/home/ec2-user/logs/jinanam-worker-out.log',
      error_file: '/home/ec2-user/logs/jinanam-worker-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      node_args: ['--max-old-space-size=200'],
    },
  ],
};
