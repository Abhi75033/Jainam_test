import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/** Generates the digital certificate (PDF + QR) once a participant hits their jatra target (§5.19). */
export function createTourMilestoneWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.TOUR_MILESTONES,
    async (job) => {
      const { generateTourCertificate } = await import('./tours99.service');
      await generateTourCertificate(job.data.participantId as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'tour-milestones job failed'));
}
