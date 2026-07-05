import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';
import { dispatchNotification, NotifyInput } from './notification.service';

export function createNotificationWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      const input = job.data as NotifyInput;
      await dispatchNotification(input);
    },
    { connection: bullConnectionOptions(), concurrency: 10 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Notification job failed'));
}
