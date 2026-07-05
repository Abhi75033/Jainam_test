export type NotificationChannel = 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'IN_APP';

export interface ChannelSendInput {
  userId: string;
  to: string; // device token / mobile / email / userId depending on channel
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ChannelSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationChannelAdapter {
  channel: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}
