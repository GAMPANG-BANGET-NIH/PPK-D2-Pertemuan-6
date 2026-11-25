export type NotificationEventType = 'session_opened' | 'schedule_changed' | 'permission_decided';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushTokenRegistration {
  uid: string;
  token: string;
  deviceId: string;
  platform: 'android' | 'ios' | 'web';
}

export interface NotificationEvent {
  type: NotificationEventType;
  targetUids: string[];
  payload: NotificationPayload;
}
