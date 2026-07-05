import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/**
 * Runs the offer notification schedule (§5.14): Day 1, Day 15, 24h before
 * expiry — repeated monthly for multi-month offers. job.data.offerId +
 * reminderKey identify the specific scheduled notification.
 */
export function createOfferScheduleWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.OFFER_SCHEDULE,
    async (job) => {
      const { sendOfferScheduledNotification } = await import('./offers.service');
      await sendOfferScheduledNotification(job.data.offerId as string, job.data.reminderKey as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'offer-schedule job failed'));
}
