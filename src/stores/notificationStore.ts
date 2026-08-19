import { create } from 'zustand';
import type { BusinessProfile } from '../services/businessService';
import { markMessagesAsRead } from '../services/rtdb/chatService';
import { subscribeToBusinessMessageNotifications } from '../services/rtdb/businessMessageNotificationListener';
import {
  createNotificationIfAbsent,
  markAllNotificationsRead,
  markNotificationRead,
  notificationFromJobResponse,
  subscribeToJobResponses,
  subscribeToNotifications,
} from '../services/rtdb/notificationService';
import type { AppNotification, JobResponsePayload } from '../types/notification';

type Unsubscribe = () => void;

interface NotificationStoreState {
  userId: string | null;
  notifications: AppNotification[];
  loading: boolean;
  unsubscribers: Unsubscribe[];
}

interface NotificationStoreActions {
  init: (
    authUid: string,
    userDocId?: string | null,
    businesses?: BusinessProfile[],
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

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

  teardown: () => {
    const { unsubscribers } = get();
    unsubscribers.forEach((unsub) => unsub());
    set({
      userId: null,
      notifications: [],
      loading: false,
      unsubscribers: [],
    });
  },

  init: (authUid, userDocId = null, businesses = []) => {
    get().teardown();

    const docId = userDocId?.trim() || null;

    set({
      userId: authUid,
      loading: true,
    });

    const unsubscribers: Unsubscribe[] = [];

    // Single source of truth: RTDB notifications/{authUid}
    unsubscribers.push(
      subscribeToNotifications(authUid, (notifications) => {
        set({ notifications, loading: false });
      }),
    );

    // Job accept/decline → persistent notification (deduped by response id)
    const onJobResponse = (
      payload: JobResponsePayload,
      responseId: string,
    ) => {
      void createNotificationIfAbsent(
        authUid,
        `jr_${responseId}`,
        notificationFromJobResponse(payload),
      ).catch((err) => {
        console.error('Failed to create job-response notification:', err);
      });
    };

    unsubscribers.push(subscribeToJobResponses(authUid, onJobResponse));
    if (docId && docId !== authUid) {
      unsubscribers.push(subscribeToJobResponses(docId, onJobResponse));
    }

    // New business messages → persistent notification (deduped by message id)
    if (businesses.length > 0) {
      unsubscribers.push(
        subscribeToBusinessMessageNotifications(authUid, businesses, {
          userDocId: docId,
        }),
      );
    }

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

    try {
      await markNotificationRead(userId, notificationId);
    } catch (err) {
      console.error('Failed to persist notification read:', err);
    }
  },

  markAllRead: async () => {
    const { userId, notifications } = get();
    if (!userId) return;

    await Promise.all(
      notifications
        .filter((n) => n.type === 'message' && n.chatId)
        .map((n) =>
          markMessagesAsRead(n.chatId!, 'user').catch(() => undefined),
        ),
    );

    set({
      notifications: notifications.map((n) => ({ ...n, read: true })),
    });

    try {
      await markAllNotificationsRead(userId);
    } catch (err) {
      console.error('Failed to persist mark-all-read:', err);
    }
  },
}));
