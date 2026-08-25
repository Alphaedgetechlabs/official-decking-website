import { create } from 'zustand';
import {
  fetchAdminSupportMessagesPage,
  markAdminMessageAsDelivered,
  markAdminMessageAsSeen,
  sendAdminSupportMessage,
  subscribeToAdminSupportMessageUpdates,
  subscribeToNewAdminSupportMessages,
} from '../services/rtdb/adminSupportChatService';
import { subscribeToAdminPresence } from '../services/rtdb/adminSupportPresenceService';
import {
  ADMIN_SUPPORT_MESSAGES_PAGE_SIZE,
  type AdminSupportMessage,
  type AdminSupportPresence,
} from '../types/adminSupportChat';
import type { PendingMediaUpload } from '../types/chat';
import {
  getMediaPreviewLabel,
  getMediaTypeFromFile,
  uploadChatMedia,
} from '../services/rtdb/chatMediaService';

type Unsubscribe = () => void;

interface AdminSupportChatState {
  userId: string | null;
  messages: AdminSupportMessage[];
  oldestKey: string | null;
  newestKey: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  sending: boolean;
  draft: string;
  error: string | null;
  adminPresence: AdminSupportPresence;
  pendingUploads: PendingMediaUpload[];
  unsubscribers: Unsubscribe[];
}

interface AdminSupportChatActions {
  openChat: (userId: string) => Promise<void>;
  closeChat: () => void;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendMedia: (file: File) => Promise<void>;
  setDraft: (draft: string) => void;
  onAdminMessageVisible: (messageId: string) => Promise<void>;
  cleanup: () => void;
}

const initialPresence: AdminSupportPresence = { isOnline: false, lastSeen: null };

function mergeMessages(
  existing: AdminSupportMessage[],
  incoming: AdminSupportMessage[],
  position: 'append' | 'prepend' | 'upsert',
): AdminSupportMessage[] {
  const map = new Map(existing.map((m) => [m.id, m]));

  for (const message of incoming) {
    if (position === 'upsert' || !map.has(message.id)) {
      map.set(message.id, message);
    }
  }

  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export const useAdminSupportChatStore = create<
  AdminSupportChatState & AdminSupportChatActions
>((set, get) => ({
  userId: null,
  messages: [],
  oldestKey: null,
  newestKey: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  sending: false,
  draft: '',
  error: null,
  adminPresence: initialPresence,
  pendingUploads: [],
  unsubscribers: [],

  setDraft: (draft) => set({ draft }),

  cleanup: () => {
    const { unsubscribers } = get();
    unsubscribers.forEach((unsub) => unsub());

    set({
      userId: null,
      messages: [],
      oldestKey: null,
      newestKey: null,
      hasMore: false,
      loading: false,
      loadingMore: false,
      sending: false,
      draft: '',
      error: null,
      adminPresence: initialPresence,
      pendingUploads: [],
      unsubscribers: [],
    });
  },

  openChat: async (userId) => {
    get().cleanup();

    set({
      userId,
      loading: true,
      error: null,
    });

    try {
      const page = await fetchAdminSupportMessagesPage(
        userId,
        ADMIN_SUPPORT_MESSAGES_PAGE_SIZE,
      );

      set({
        messages: page.messages,
        oldestKey: page.oldestKey,
        newestKey: page.newestKey,
        hasMore: page.hasMore,
        loading: false,
      });

      const unsubscribers: Unsubscribe[] = [];

      unsubscribers.push(
        subscribeToNewAdminSupportMessages(
          userId,
          page.newestKey,
          (message) => {
            set((state) => ({
              messages: mergeMessages(state.messages, [message], 'upsert'),
              newestKey: message.id,
            }));

            if (message.sender === 'admin' && message.status === 'sent') {
              void markAdminMessageAsDelivered(userId, message.id);
            }
          },
        ),
      );

      unsubscribers.push(
        subscribeToAdminSupportMessageUpdates(userId, (message) => {
          set((state) => ({
            messages: mergeMessages(state.messages, [message], 'upsert'),
          }));
        }),
      );

      unsubscribers.push(
        subscribeToAdminPresence((presence) => {
          set({ adminPresence: presence });
        }),
      );

      set({ unsubscribers });
    } catch (err) {
      console.error('Failed to open admin support chat:', err);
      set({
        loading: false,
        error: 'Unable to load support chat. Please try again.',
      });
    }
  },

  loadMoreMessages: async () => {
    const { userId, oldestKey, hasMore, loadingMore, messages } = get();
    if (!userId || !hasMore || loadingMore || !oldestKey) return;

    set({ loadingMore: true });

    try {
      const page = await fetchAdminSupportMessagesPage(
        userId,
        ADMIN_SUPPORT_MESSAGES_PAGE_SIZE,
        oldestKey,
      );

      set({
        messages: mergeMessages(messages, page.messages, 'prepend'),
        oldestKey: page.oldestKey ?? oldestKey,
        hasMore: page.hasMore,
        loadingMore: false,
      });
    } catch (err) {
      console.error('Failed to load older support messages:', err);
      set({ loadingMore: false });
    }
  },

  sendMessage: async (text) => {
    const { userId, sending } = get();
    const trimmed = text.trim();
    if (!userId || !trimmed || sending) return;

    set({ sending: true, draft: '' });

    try {
      const message = await sendAdminSupportMessage(userId, trimmed);

      set((state) => ({
        messages: mergeMessages(state.messages, [message], 'upsert'),
        newestKey: message.id,
        sending: false,
      }));
    } catch (err) {
      console.error('Failed to send support message:', err);
      set({ sending: false, draft: trimmed });
    }
  },

  sendMedia: async (file) => {
    const { userId, sending, pendingUploads } = get();
    if (!userId || sending) return;

    const mediaType = getMediaTypeFromFile(file);
    if (!mediaType) return;

    const uploadId = `upload-${Date.now()}`;
    const previewUrl =
      mediaType === 'image' || mediaType === 'video'
        ? URL.createObjectURL(file)
        : undefined;

    const pendingUpload: PendingMediaUpload = {
      id: uploadId,
      mediaType,
      progress: 0,
      previewUrl,
    };

    set({
      sending: true,
      pendingUploads: [...pendingUploads, pendingUpload],
    });

    try {
      const uploaded = await uploadChatMedia(
        `adminSupportChats/${userId}/media`,
        file,
        mediaType,
        (progress) => {
          set((state) => ({
            pendingUploads: state.pendingUploads.map((upload) =>
              upload.id === uploadId ? { ...upload, progress } : upload,
            ),
          }));
        },
      );

      const message = await sendAdminSupportMessage(
        userId,
        getMediaPreviewLabel(uploaded.mediaType, uploaded.fileName),
        {
          mediaUrl: uploaded.mediaUrl,
          mediaType: uploaded.mediaType,
          thumbnailUrl: uploaded.thumbnailUrl,
          fileName: uploaded.fileName,
        },
      );

      set((state) => ({
        messages: mergeMessages(state.messages, [message], 'upsert'),
        newestKey: message.id,
        sending: false,
        pendingUploads: state.pendingUploads.filter(
          (upload) => upload.id !== uploadId,
        ),
      }));
    } catch (err) {
      console.error('Failed to send support media:', err);
      set((state) => ({
        sending: false,
        pendingUploads: state.pendingUploads.filter(
          (upload) => upload.id !== uploadId,
        ),
      }));
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  },

  onAdminMessageVisible: async (messageId) => {
    const { userId, messages } = get();
    if (!userId) return;

    const message = messages.find((m) => m.id === messageId);
    if (!message || message.sender !== 'admin' || message.status === 'seen') {
      return;
    }

    if (message.status === 'sent') {
      await markAdminMessageAsDelivered(userId, messageId);
      return;
    }

    if (message.status === 'delivered') {
      await markAdminMessageAsSeen(userId, messageId);
    }
  },

  closeChat: () => {
    get().cleanup();
  },
}));
