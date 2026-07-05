import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Releases Redis-TTL seat locks that expired without a completed purchase (§5.9 seating engine). */
export function createSeatLockReleaseWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.SEAT_LOCK_RELEASE,
    async (job) => {
      const { releaseExpiredSeatLock } = await import('./seating.service');
      await releaseExpiredSeatLock(job.data.seatId as string, job.data.lockToken as string);
    },
    { connection: bullConnectionOptions(), concurrency: 10 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'seat-lock-release job failed'));
}
