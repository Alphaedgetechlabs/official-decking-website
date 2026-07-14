export type NotificationType =
  | 'message'
  | 'job_accepted'
  | 'job_rejected'
  | 'quote'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  timestamp: number;
  businessId?: string;
  businessName?: string;
  chatId?: string;
  jobId?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  businessId?: string;
  businessName?: string;
  chatId?: string;
  jobId?: string;
}

export interface JobResponsePayload {
  businessId: string;
  businessName: string;
  jobTitle: string;
  action: 'accepted' | 'rejected';
  timestamp?: number;
  jobId?: string;
}

export const NOTIFICATION_PATHS = {
  user: (userId: string) => `notifications/${userId}`,
  item: (userId: string, id: string) => `notifications/${userId}/${id}`,
  jobResponses: (userId: string) => `jobResponses/${userId}`,
} as const;
