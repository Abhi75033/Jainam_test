import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/**
 * Recomputes community page subscription status daily (§5.16): flips
 * Active -> Expiring Soon -> Expired, locking owner management access on
 * expiry while keeping the page/content publicly visible.
 */
export function createCommunityPageSubscriptionWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.COMMUNITY_PAGE_SUBSCRIPTION,
    async (job) => {
      const { recomputeSubscriptionStatuses } = await import('./communityPages.service');
      await recomputeSubscriptionStatuses();
      logger.debug({ jobId: job.id }, 'community-page-subscription statuses recomputed');
    },
    { connection: bullConnectionOptions(), concurrency: 1 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'community-page-subscription job failed'));
}
