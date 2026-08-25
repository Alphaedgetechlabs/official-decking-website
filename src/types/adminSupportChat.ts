import type { ChatMediaType } from './chat';

export type AdminSupportSender = 'user' | 'admin';

export type AdminSupportMessageStatus = 'sent' | 'delivered' | 'seen';

export interface AdminSupportMediaPayload {
  mediaUrl: string;
  mediaType: ChatMediaType;
  thumbnailUrl?: string;
  fileName?: string;
}

export interface AdminSupportMessage {
  id: string;
  text: string;
  sender: AdminSupportSender;
  timestamp: number;
  status: AdminSupportMessageStatus;
  mediaUrl?: string;
  mediaType?: ChatMediaType;
  thumbnailUrl?: string;
  fileName?: string;
}

export interface AdminSupportPresence {
  isOnline: boolean;
  lastSeen: number | null;
}

export const ADMIN_SUPPORT_MESSAGES_PAGE_SIZE = 20;

export const ADMIN_SUPPORT_PATHS = {
  messages: (userId: string) => `adminSupportChats/messages/${userId}`,
  userPresence: (userId: string) => `adminSupportChats/presence/${userId}`,
  adminPresence: 'adminSupportChats/presence/admin',
} as const;
