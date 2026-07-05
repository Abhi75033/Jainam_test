import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ChannelSendInput, ChannelSendResult, NotificationChannelAdapter } from '../channel.interface';

/** SMTP email adapter. Wire nodemailer once SMTP_* env vars are provisioned. */
export const emailAdapter: NotificationChannelAdapter = {
  channel: 'EMAIL',
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!env.SMTP_HOST) {
      logger.debug({ to: input.to }, '[email:noop] SMTP not configured, logging only');
      return { success: true, providerMessageId: `noop-${Date.now()}` };
    }
    try {
      // TODO: send via nodemailer transport using env.SMTP_*.
      return { success: true, providerMessageId: `smtp-${Date.now()}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
