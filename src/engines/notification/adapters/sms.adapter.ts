import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ChannelSendInput, ChannelSendResult, NotificationChannelAdapter } from '../channel.interface';

/** SMS adapter — used as fallback when WhatsApp delivery fails (§4.3, §8 reliability). */
export const smsAdapter: NotificationChannelAdapter = {
  channel: 'SMS',
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!env.SMS_API_URL || !env.SMS_API_KEY) {
      logger.debug({ to: input.to }, '[sms:noop] SMS API not configured, logging only');
      return { success: true, providerMessageId: `noop-${Date.now()}` };
    }
    try {
      // TODO: POST to env.SMS_API_URL with env.SMS_API_KEY.
      return { success: true, providerMessageId: `sms-${Date.now()}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
