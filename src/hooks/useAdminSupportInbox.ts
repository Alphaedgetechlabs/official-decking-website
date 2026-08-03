import { useEffect, useMemo, useState } from 'react';
import type { MessageItem } from '../data/messages';
import {
  ADMIN_SUPPORT_CHAT_ID,
  subscribeToAdminSupportInbox,
  type AdminSupportInboxState,
} from '../services/rtdb/adminSupportInboxService';
import { subscribeToAdminPresence } from '../services/rtdb/adminSupportPresenceService';
import type { AdminSupportPresence } from '../types/adminSupportChat';
import { formatRelativeTime } from '../utils/formatRelativeTime';

const emptyInbox: AdminSupportInboxState = {
  preview: '',
  lastMessageAt: null,
  unread: false,
  hasConversation: false,
};

const offlinePresence: AdminSupportPresence = {
  isOnline: false,
  lastSeen: null,
};

export function useAdminSupportInbox(userDocId: string | null | undefined) {
  const [inbox, setInbox] = useState<AdminSupportInboxState>(emptyInbox);
  const [adminPresence, setAdminPresence] =
    useState<AdminSupportPresence>(offlinePresence);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docId = userDocId?.trim();
    if (!docId) {
      setInbox(emptyInbox);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = subscribeToAdminSupportInbox(docId, (state) => {
      setInbox(state);
      setLoading(false);
    });

    return unsub;
  }, [userDocId]);

  useEffect(() => {
    if (!userDocId?.trim()) {
      setAdminPresence(offlinePresence);
      return;
    }

    return subscribeToAdminPresence(setAdminPresence);
  }, [userDocId]);

  const messageItem = useMemo((): MessageItem | null => {
    if (!userDocId?.trim()) return null;

    return {
      id: ADMIN_SUPPORT_CHAT_ID,
      chatId: `support_${userDocId}`,
      businessId: ADMIN_SUPPORT_CHAT_ID,
      name: 'QuoteMyFence Support',
      rating: 0,
      time: inbox.lastMessageAt
        ? formatRelativeTime(inbox.lastMessageAt)
        : '',
      preview: inbox.preview || 'Chat with our support team',
      status: inbox.unread ? 'Unread' : inbox.hasConversation ? 'Read' : '',
      unread: inbox.unread,
      isOnline: adminPresence.isOnline,
      lastMessageAt: inbox.lastMessageAt ?? undefined,
      hasConversation: inbox.hasConversation,
      initials: 'QM',
      avatarBg: 'bg-brand-light',
      avatarText: 'text-brand',
      isAdmin: true,
    };
  }, [userDocId, inbox, adminPresence.isOnline]);

  return { messageItem, loading, adminPresence };
}

export { ADMIN_SUPPORT_CHAT_ID };
