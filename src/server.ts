import http from 'http';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { redis } from '@/config/redis';
import { initSockets } from '@/sockets';

async function main() {
  const app = createApp();
  const httpServer = http.createServer(app);

  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`JiNANAM API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Swagger docs: http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
