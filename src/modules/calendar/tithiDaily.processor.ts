import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Daily morning tithi notification per member's selected calendar + temple admins (§4.3). */
export function createTithiDailyWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.TITHI_DAILY,
    async (job) => {
      const { sendDailyTithiNotifications } = await import('./calendar.service');
      await sendDailyTithiNotifications();
      logger.debug({ jobId: job.id }, 'tithi-daily notifications dispatched');
    },
    { connection: bullConnectionOptions(), concurrency: 1 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'tithi-daily job failed'));
}
