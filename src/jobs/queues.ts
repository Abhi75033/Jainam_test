import { Queue, QueueOptions } from 'bullmq';
import { bullConnectionOptions } from '@/config/redis';

const connection = bullConnectionOptions();

const defaultOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

/** Queue names — central registry so processors/producers agree on strings. */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  BOOKING_PAYMENT_WINDOW: 'booking-payment-window',
  EVENT_LIFECYCLE: 'event-lifecycle',
  EVENT_REMINDERS: 'event-reminders',
  OFFER_SCHEDULE: 'offer-schedule',
  NEWS_ARCHIVE: 'news-archive',
  COMMUNITY_PAGE_SUBSCRIPTION: 'community-page-subscription',
  TOUR_MILESTONES: 'tour-milestones',
  DEVICE_ALERTS: 'device-alerts',
  TITHI_DAILY: 'tithi-daily',
  SEAT_LOCK_RELEASE: 'seat-lock-release',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, defaultOptions);
    queues.set(name, queue);
  }
  return queue;
}

export function allQueues(): Queue[] {
  return Object.values(QUEUE_NAMES).map((name) => getQueue(name));
}
