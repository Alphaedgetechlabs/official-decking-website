export interface MessageItem {
  id: string;
  chatId: string;
  businessId: string;
  name: string;
  rating: number;
  time: string;
  preview: string;
  status: string;
  unread?: boolean;
  isOnline?: boolean;
  lastMessageAt?: number;
  hasConversation?: boolean;
  initials: string;
  avatarBg: string;
  avatarText: string;
  isAdmin?: boolean;
}
