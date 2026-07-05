import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/**
 * Auto-completes events at end time (§5.9): closes RSVP/sales, flips status to
 * COMPLETED, enables gallery + feedback. Scheduled by events.service.ts on publish.
 */
export function createEventLifecycleWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.EVENT_LIFECYCLE,
    async (job) => {
      const { autoCompleteEvent } = await import('./events.service');
      await autoCompleteEvent(job.data.eventId as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'event-lifecycle job failed'));
}
