import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ChannelSendInput, ChannelSendResult, NotificationChannelAdapter } from '../channel.interface';

/** FCM push adapter. Wire the real Firebase Admin SDK call once FCM_SERVER_KEY is provisioned. */
export const pushAdapter: NotificationChannelAdapter = {
  channel: 'PUSH',
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!env.FCM_SERVER_KEY) {
      logger.debug({ to: input.to }, '[push:noop] FCM_SERVER_KEY not configured, logging only');
      return { success: true, providerMessageId: `noop-${Date.now()}` };
    }
    // TODO: call FCM HTTP v1 API with input.to as the device token.
    return { success: true, providerMessageId: `fcm-${Date.now()}` };
  },
};
