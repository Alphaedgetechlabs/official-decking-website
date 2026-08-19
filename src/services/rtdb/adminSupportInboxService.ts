import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { rtdb } from '../../firebase';
import { ADMIN_SUPPORT_PATHS } from '../../types/adminSupportChat';

export const ADMIN_SUPPORT_CHAT_ID = 'admin-support';

export interface AdminSupportInboxState {
  preview: string;
  lastMessageAt: number | null;
  unread: boolean;
  hasConversation: boolean;
}

function parseMessage(value: unknown): {
  text: string;
  sender: string;
  status: string;
  timestamp: number;
} | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.text !== 'string' || !data.text) return null;

  return {
    text: data.text,
    sender: typeof data.sender === 'string' ? data.sender : '',
    status: typeof data.status === 'string' ? data.status : 'sent',
    timestamp:
      typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
        ? data.timestamp
        : Date.now(),
  };
}

export function subscribeToAdminSupportInbox(
  userDocId: string,
  onUpdate: (state: AdminSupportInboxState) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userDocId));

  return onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate({
        preview: '',
        lastMessageAt: null,
        unread: false,
        hasConversation: false,
      });
      return;
    }

    let preview = '';
    let lastMessageAt: number | null = null;
    let unread = false;

    snapshot.forEach((child) => {
      const message = parseMessage(child.val());
      if (!message) return;

      if (message.sender === 'admin' && message.status !== 'seen') {
        unread = true;
      }

      if (lastMessageAt === null || message.timestamp >= lastMessageAt) {
        lastMessageAt = message.timestamp;
        preview = message.text;
      }
    });

    onUpdate({
      preview,
      lastMessageAt,
      unread,
      hasConversation: true,
    });
  });
}
