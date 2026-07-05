import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Auto-archives news after its 7-day max active life (§5.15). job.data.newsId. */
export function createNewsArchiveWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.NEWS_ARCHIVE,
    async (job) => {
      const { archiveNews } = await import('./news.service');
      await archiveNews(job.data.newsId as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'news-archive job failed'));
}
