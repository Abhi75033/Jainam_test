import { getQueue, QUEUE_NAMES } from './queues';
import { logger } from '@/config/logger';

/**
 * Registers all recurring (repeatable) jobs on worker startup. One-shot delayed
 * jobs (payment windows, event reminders, offer schedules, news archival, seat
 * releases, tour certificates) are enqueued by their owning services; the jobs
 * below are the platform's heartbeat crons.
 */
export async function registerRepeatableJobs() {
  // Daily morning tithi notification (§4.3) — 06:30 IST = 01:00 UTC
  await getQueue(QUEUE_NAMES.TITHI_DAILY).add('daily', {}, { repeat: { pattern: '0 1 * * *' }, jobId: 'tithi-daily-cron' });

  // Device offline/battery/SIM sweep every 15 minutes (§5.10)
  await getQueue(QUEUE_NAMES.DEVICE_ALERTS).add('sweep', {}, { repeat: { pattern: '*/15 * * * *' }, jobId: 'device-alerts-cron' });

  // Community page subscription status recompute, daily (§5.16)
  await getQueue(QUEUE_NAMES.COMMUNITY_PAGE_SUBSCRIPTION).add('recompute', {}, { repeat: { pattern: '30 1 * * *' }, jobId: 'page-subscription-cron' });

  // Feed post auto activate/deactivate by start/end dates, hourly (§5.13)
  await getQueue(QUEUE_NAMES.FEED_ACTIVATION).add('refresh', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'feed-activation-cron' });

  // Staff document-expiry + not-checked-out sweep, daily (§4.3)
  await getQueue(QUEUE_NAMES.STAFF_SWEEPS).add('sweep', {}, { repeat: { pattern: '0 2 * * *' }, jobId: 'staff-sweep-cron' });

  logger.info('Registered 5 repeatable cron jobs (tithi, device sweep, page subscriptions, feed activation, staff sweep)');
}
