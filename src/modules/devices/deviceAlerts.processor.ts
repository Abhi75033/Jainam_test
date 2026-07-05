import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Periodic sweep for offline devices / low battery / SIM expiry thresholds (§5.10, §4.3). */
export function createDeviceAlertWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.DEVICE_ALERTS,
    async (job) => {
      const { runDeviceAlertSweep } = await import('./devices.service');
      await runDeviceAlertSweep();
      logger.debug({ jobId: job.id }, 'device-alerts sweep completed');
    },
    { connection: bullConnectionOptions(), concurrency: 1 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'device-alerts job failed'));
}
