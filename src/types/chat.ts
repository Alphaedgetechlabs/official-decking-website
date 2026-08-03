export type MessageStatus = 'sent' | 'delivered' | 'read';
export type SenderType = 'user' | 'business';
export type ChatMediaType = 'image' | 'video' | 'document';

export interface ChatMediaPayload {
  mediaUrl: string;
  mediaType: ChatMediaType;
  thumbnailUrl?: string;
  fileName?: string;
}

export interface RtdbChatMessage {
  id: string;
  senderId: string;
  senderType: SenderType;
  text: string;
  timestamp: number;
  status: MessageStatus;
  mediaUrl?: string;
  mediaType?: ChatMediaType;
  thumbnailUrl?: string;
  fileName?: string;
}

export interface PendingMediaUpload {
  id: string;
  mediaType: ChatMediaType;
  progress: number;
  previewUrl?: string;
}

export interface UserPresence {
  online: boolean;
  last_active: number | null;
}

export interface ChatMeta {
  userId: string;
  businessId: string;
  businessName: string;
  updatedAt: number;
}

export const MESSAGES_PAGE_SIZE = 20;

export const CHAT_PATHS = {
  messages: (chatId: string) => `chats/${chatId}/messages`,
  meta: (chatId: string) => `chats/${chatId}/meta`,
  status: (userId: string) => `status/${userId}`,
  userChats: (userId: string) => `userChats/${userId}`,
  userChatIndex: (userId: string, chatId: string) =>
    `userChats/${userId}/${chatId}`,
} as const;
