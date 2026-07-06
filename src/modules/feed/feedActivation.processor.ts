import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Hourly refresh: auto activate/deactivate feed posts by their start/end dates (§5.13). */
export function createFeedActivationWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.FEED_ACTIVATION,
    async () => {
      const { refreshPostActivations } = await import('./feed.service');
      await refreshPostActivations();
    },
    { connection: bullConnectionOptions(), concurrency: 1 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'feed-activation job failed'));
}
