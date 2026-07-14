import { create } from 'zustand';
import {
  createNotification,
  notificationFromJobResponse,
  subscribeToJobResponses,
} from '../services/rtdb/notificationService';
import { markMessagesAsRead } from '../services/rtdb/chatService';
import { subscribeToUserNotifications } from '../services/rtdb/userNotificationBuilder';
import type { AppNotification } from '../types/notification';

type Unsubscribe = () => void;

interface NotificationStoreState {
  userId: string | null;
  notifications: AppNotification[];
  loading: boolean;
  unsubscribers: Unsubscribe[];
  processedJobResponses: Set<string>;
}

interface NotificationStoreActions {
  init: (
    authUid: string,
    userDocId?: string | null,
    businessIds?: string[],
  ) => void;
  teardown: () => void;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<
  NotificationStoreState & NotificationStoreActions
>((set, get) => ({
  userId: null,
  notifications: [],
  loading: false,
  unsubscribers: [],
  processedJobResponses: new Set(),

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

  teardown: () => {
    const { unsubscribers } = get();
    unsubscribers.forEach((unsub) => unsub());
    set({
      userId: null,
      notifications: [],
      loading: false,
      unsubscribers: [],
      processedJobResponses: new Set(),
    });
  },

  init: (authUid, userDocId = null, businessIds = []) => {
    get().teardown();

    const docId = userDocId?.trim() || null;

    set({
      userId: authUid,
      loading: true,
      processedJobResponses: new Set(),
    });

    const unsubscribers: Unsubscribe[] = [];

    unsubscribers.push(
      subscribeToUserNotifications(authUid, docId, businessIds, (notifications) => {
        set({ notifications, loading: false });
      }),
    );

    unsubscribers.push(
      subscribeToJobResponses(authUid, (payload, responseId) => {
        const { processedJobResponses } = get();
        if (processedJobResponses.has(responseId)) return;

        set({
          processedJobResponses: new Set([...processedJobResponses, responseId]),
        });

        void createNotification(authUid, notificationFromJobResponse(payload));
      }),
    );

    set({ unsubscribers });
  },

  markRead: async (notificationId) => {
    const { userId, notifications } = get();
    if (!userId) return;

    const item = notifications.find((n) => n.id === notificationId);
    if (item?.type === 'message' && item.chatId) {
      try {
        await markMessagesAsRead(item.chatId, 'user');
      } catch (err) {
        console.error('Failed to mark chat messages read:', err);
      }
    }

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n,
      ),
    }));
  },

  markAllRead: async () => {
    const { userId, notifications } = get();
    if (!userId) return;

    await Promise.all(
      notifications
        .filter((n) => n.type === 'message' && n.chatId)
        .map((n) => markMessagesAsRead(n.chatId!, 'user').catch(() => undefined)),
    );

    set({
      notifications: notifications.map((n) => ({ ...n, read: true })),
    });
  },
}));
