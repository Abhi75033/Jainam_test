import { prisma } from '@/config/prisma';
import { logger } from '@/config/logger';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { NotificationChannel } from './channel.interface';
import { pushAdapter } from './adapters/push.adapter';
import { whatsappAdapter } from './adapters/whatsapp.adapter';
import { smsAdapter } from './adapters/sms.adapter';
import { emailAdapter } from './adapters/email.adapter';
import { inAppAdapter } from './adapters/inApp.adapter';

const ADAPTERS = {
  PUSH: pushAdapter,
  WHATSAPP: whatsappAdapter,
  SMS: smsAdapter,
  EMAIL: emailAdapter,
  IN_APP: inAppAdapter,
} as const;

export interface NotifyInput {
  userId: string;
  templateKey: string;
  category: 'SERVICE' | 'MARKETING';
  channels?: NotificationChannel[]; // explicit override; else derived from member prefs
  to: Partial<Record<NotificationChannel, string>>; // resolved addresses per channel
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Enqueues a notification job — actual sending happens in the BullMQ worker (notification.processor.ts). */
export async function enqueueNotification(input: NotifyInput, delayMs = 0): Promise<void> {
  await getQueue(QUEUE_NAMES.NOTIFICATIONS).add('send', input, { delay: delayMs });
}

/**
 * Resolves which channels to actually attempt for a user, honoring per-member
 * service/marketing channel preferences (§5.2 notification preferences).
 */
async function resolveChannels(userId: string, category: 'SERVICE' | 'MARKETING'): Promise<NotificationChannel[]> {
  const member = await prisma.member.findUnique({ where: { userId }, select: { id: true } });
  if (!member) return ['IN_APP', 'PUSH'];

  const prefs = await prisma.memberNotificationPreference.findMany({
    where: { memberId: member.id, category },
  });
  const enabled = prefs.filter((p) => p.enabled).map((p) => p.channel as NotificationChannel);
  return enabled.length > 0 ? enabled : ['IN_APP', 'PUSH'];
}

const LOCALE_BY_LANGUAGE: Record<string, string> = { English: 'en', Hindi: 'hi', Gujarati: 'gu' };

/**
 * Member preferred language drives templates (§7): if a NotificationTemplate
 * exists for (key, channel, member locale), it overrides the caller's body.
 * Falls back to the 'en' template, then the literal body passed in.
 */
async function resolveBody(input: NotifyInput, channel: NotificationChannel): Promise<{ subject?: string; body: string }> {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { preferredLanguage: true } });
  const locale = LOCALE_BY_LANGUAGE[user?.preferredLanguage ?? 'English'] ?? 'en';

  const template =
    (await prisma.notificationTemplate.findUnique({ where: { key_channel_locale: { key: input.templateKey, channel, locale } } })) ??
    (locale !== 'en'
      ? await prisma.notificationTemplate.findUnique({ where: { key_channel_locale: { key: input.templateKey, channel, locale: 'en' } } })
      : null);

  if (!template) return { subject: input.subject, body: input.body };

  const interpolate = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => String((input.data as Record<string, unknown> | undefined)?.[key] ?? ''));
  return { subject: template.subjectTemplate ? interpolate(template.subjectTemplate) : input.subject, body: interpolate(template.bodyTemplate) };
}

/** Executes the actual send with WhatsApp -> SMS failover, logging every attempt to NotificationLog. */
export async function dispatchNotification(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? (await resolveChannels(input.userId, input.category));

  for (const channel of channels) {
    const to = input.to[channel];
    if (!to) continue;

    const log = await prisma.notificationLog.create({
      data: {
        recipientUserId: input.userId,
        channel,
        templateKey: input.templateKey,
        payload: input.data as any,
        status: 'QUEUED',
      },
    });

    const adapter = ADAPTERS[channel];
    const { subject, body } = await resolveBody(input, channel);
    const result = await adapter.send({ userId: input.userId, to, subject, body, data: input.data });

    if (result.success) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      continue;
    }

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMessage: result.error },
    });

    // WhatsApp -> SMS failover (§4.3, §8)
    if (channel === 'WHATSAPP' && input.to.SMS) {
      logger.warn({ userId: input.userId }, 'WhatsApp delivery failed, falling back to SMS');
      const smsLog = await prisma.notificationLog.create({
        data: {
          recipientUserId: input.userId,
          channel: 'SMS',
          templateKey: input.templateKey,
          payload: input.data as any,
          status: 'QUEUED',
        },
      });
      const smsResult = await smsAdapter.send({ userId: input.userId, to: input.to.SMS, body, data: input.data });
      await prisma.notificationLog.update({
        where: { id: smsLog.id },
        data: smsResult.success
          ? { status: 'SENT', sentAt: new Date() }
          : { status: 'FAILED', errorMessage: smsResult.error },
      });
    }
  }
}

export async function markNotificationOpened(notificationLogId: string): Promise<void> {
  await prisma.notificationLog.update({
    where: { id: notificationLogId },
    data: { status: 'OPENED', openedAt: new Date() },
  });
}
