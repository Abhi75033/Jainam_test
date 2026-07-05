import { ChannelSendInput, ChannelSendResult, NotificationChannelAdapter } from '../channel.interface';

/** In-app notification — persisted purely via NotificationLog; no external delivery needed. */
export const inAppAdapter: NotificationChannelAdapter = {
  channel: 'IN_APP',
  async send(_input: ChannelSendInput): Promise<ChannelSendResult> {
    return { success: true, providerMessageId: `inapp-${Date.now()}` };
  },
};
