import { Worker } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/jobs/queues';

/**
 * Processes delayed payment-window-expiry jobs (§5.7): if a booking is still
 * PAYMENT_PENDING/PAYMENT_VERIFICATION when this fires, auto-cancel + release
 * the slot + notify. Enqueued by bookings.service.ts when a booking is Approved.
 */
export function createBookingPaymentWindowWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.BOOKING_PAYMENT_WINDOW,
    async (job) => {
      const { expireBookingPaymentWindow } = await import('./bookings.service');
      await expireBookingPaymentWindow(job.data.bookingId as string);
    },
    { connection: bullConnectionOptions(), concurrency: 5 },
  ).on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'booking-payment-window job failed'));
}
