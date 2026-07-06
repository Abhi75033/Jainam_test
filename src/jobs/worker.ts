import 'dotenv/config';
import { logger } from '@/config/logger';
import { createNotificationWorker } from '@/engines/notification/notification.processor';
import { createBookingPaymentWindowWorker } from '@/modules/bookings/bookingPaymentWindow.processor';
import { createEventLifecycleWorker } from '@/modules/events/eventLifecycle.processor';
import { createEventReminderWorker } from '@/modules/events/eventReminders.processor';
import { createOfferScheduleWorker } from '@/modules/offers/offerSchedule.processor';
import { createNewsArchiveWorker } from '@/modules/news/newsArchive.processor';
import { createCommunityPageSubscriptionWorker } from '@/modules/communityPages/communityPageSubscription.processor';
import { createTourMilestoneWorker } from '@/modules/tours99/tourMilestone.processor';
import { createDeviceAlertWorker } from '@/modules/devices/deviceAlerts.processor';
import { createTithiDailyWorker } from '@/modules/calendar/tithiDaily.processor';
import { createSeatLockReleaseWorker } from '@/modules/seating/seatLockRelease.processor';
import { createStaffSweepWorker } from '@/modules/staff/staffSweep.processor';
import { createFeedActivationWorker } from '@/modules/feed/feedActivation.processor';
import { registerRepeatableJobs } from './scheduler';

/**
 * Standalone BullMQ worker process (`npm run worker`). Kept separate from the
 * HTTP API process so job processing scales independently (§8 non-functional:
 * "jobs distributed via BullMQ").
 */
async function main() {
  const workers = [
    createNotificationWorker(),
    createBookingPaymentWindowWorker(),
    createEventLifecycleWorker(),
    createEventReminderWorker(),
    createOfferScheduleWorker(),
    createNewsArchiveWorker(),
    createCommunityPageSubscriptionWorker(),
    createTourMilestoneWorker(),
    createDeviceAlertWorker(),
    createTithiDailyWorker(),
    createSeatLockReleaseWorker(),
    createStaffSweepWorker(),
    createFeedActivationWorker(),
  ];

  await registerRepeatableJobs();

  logger.info(`JiNANAM worker process started with ${workers.length} queue workers`);

  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error starting worker process');
  process.exit(1);
});
