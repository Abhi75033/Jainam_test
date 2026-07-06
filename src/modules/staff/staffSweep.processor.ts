import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Daily staff sweep: document expiry + not-checked-out notifications (§4.3). */
export function createStaffSweepWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.STAFF_SWEEPS,
    async () => {
      const { runStaffSweep } = await import('./staffSweep.service');
      await runStaffSweep();
    },
    { connection: bullConnectionOptions(), concurrency: 1 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'staff-sweeps job failed'));
}
