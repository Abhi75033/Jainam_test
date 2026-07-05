import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/**
 * Sends free/paid event reminder notifications at the offsets defined in
 * §4.3 (48h/12h/2h free; every 3 days + 24h/2h paid). job.data.reminderKey
 * identifies which reminder in the matrix fired.
 */
export function createEventReminderWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.EVENT_REMINDERS,
    async (job) => {
      const { sendEventReminder } = await import('./events.service');
      await sendEventReminder(job.data.eventId as string, job.data.reminderKey as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'event-reminders job failed'));
}
