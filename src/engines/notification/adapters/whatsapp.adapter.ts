import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ChannelSendInput, ChannelSendResult, NotificationChannelAdapter } from '../channel.interface';

/** WhatsApp Business API adapter. Falls back to SMS on failure (handled by notification.service). */
export const whatsappAdapter: NotificationChannelAdapter = {
  channel: 'WHATSAPP',
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!env.WHATSAPP_API_URL || !env.WHATSAPP_API_TOKEN) {
      logger.debug({ to: input.to }, '[whatsapp:noop] WhatsApp API not configured, logging only');
      return { success: true, providerMessageId: `noop-${Date.now()}` };
    }
    try {
      // TODO: POST to env.WHATSAPP_API_URL with Bearer env.WHATSAPP_API_TOKEN.
      return { success: true, providerMessageId: `wa-${Date.now()}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
