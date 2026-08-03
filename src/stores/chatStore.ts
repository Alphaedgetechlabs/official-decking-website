import { create } from 'zustand';
import type { MessageItem } from '../data/messages';
import {
  ensureChatMeta,
  fetchMessagesPage,
  markMessagesAsRead,
  markOutgoingAsDelivered,
  sendMessage,
  subscribeToMessageUpdates,
  subscribeToNewMessages,
} from '../services/rtdb/chatService';
import type { UserPresence } from '../types/chat';
import {
  subscribeToPresence,
} from '../services/rtdb/presenceService';
import type { PendingMediaUpload, RtdbChatMessage } from '../types/chat';
import { MESSAGES_PAGE_SIZE } from '../types/chat';
import {
  getMediaPreviewLabel,
  getMediaTypeFromFile,
  uploadChatMedia,
} from '../services/rtdb/chatMediaService';

type Unsubscribe = () => void;

interface ChatStoreState {
  chatId: string | null;
  userId: string | null;
  businessId: string | null;
  contact: MessageItem | null;
  messages: RtdbChatMessage[];
  oldestKey: string | null;
  newestKey: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  sending: boolean;
  draft: string;
  error: string | null;
  businessPresence: UserPresence;
  pendingUploads: PendingMediaUpload[];
  unsubscribers: Unsubscribe[];
}

interface ChatStoreActions {
  openChat: (contact: MessageItem, userId: string) => Promise<void>;
  closeChat: () => void;
  loadMoreMessages: () => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  sendChatMedia: (file: File) => Promise<void>;
  setDraft: (draft: string) => void;
  cleanup: () => void;
}

const initialPresence: UserPresence = { online: false, last_active: null };

function mergeMessages(
  existing: RtdbChatMessage[],
  incoming: RtdbChatMessage[],
  position: 'append' | 'prepend' | 'upsert',
): RtdbChatMessage[] {
  const map = new Map(existing.map((m) => [m.id, m]));

  for (const message of incoming) {
    if (position === 'upsert' || !map.has(message.id)) {
      map.set(message.id, message);
    }
  }

  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>(
  (set, get) => ({
    chatId: null,
    userId: null,
    businessId: null,
    contact: null,
    messages: [],
    oldestKey: null,
    newestKey: null,
    hasMore: false,
    loading: false,
    loadingMore: false,
    sending: false,
    draft: '',
    error: null,
    businessPresence: initialPresence,
    pendingUploads: [],
    unsubscribers: [],

    setDraft: (draft) => set({ draft }),

    cleanup: () => {
      const { unsubscribers } = get();
      unsubscribers.forEach((unsub) => unsub());
      set({
        chatId: null,
        userId: null,
        businessId: null,
        contact: null,
        messages: [],
        oldestKey: null,
        newestKey: null,
        hasMore: false,
        loading: false,
        loadingMore: false,
        sending: false,
        draft: '',
        error: null,
        businessPresence: initialPresence,
        pendingUploads: [],
        unsubscribers: [],
      });
    },

    openChat: async (contact, userId) => {
      get().cleanup();

      set({
        chatId: contact.chatId,
        userId,
        businessId: contact.businessId,
        contact,
        loading: true,
        error: null,
      });

      try {
        await ensureChatMeta(contact.chatId, {
          userId,
          businessId: contact.businessId,
          businessName: contact.name,
        });

        const page = await fetchMessagesPage(contact.chatId, MESSAGES_PAGE_SIZE);

        set({
          messages: page.messages,
          oldestKey: page.oldestKey,
          newestKey: page.newestKey,
          hasMore: page.hasMore,
          loading: false,
        });

        await markMessagesAsRead(contact.chatId, 'user');

        const unsubscribers: Unsubscribe[] = [];

        unsubscribers.push(
          subscribeToNewMessages(
            contact.chatId,
            page.newestKey,
            (message) => {
              set((state) => ({
                messages: mergeMessages(state.messages, [message], 'upsert'),
                newestKey: message.id,
              }));

              if (message.senderType === 'business') {
                void markMessagesAsRead(contact.chatId, 'user');
              }
            },
          ),
        );

        unsubscribers.push(
          subscribeToMessageUpdates(contact.chatId, (message) => {
            set((state) => ({
              messages: mergeMessages(state.messages, [message], 'upsert'),
            }));
          }),
        );

        unsubscribers.push(
          subscribeToPresence(contact.businessId, (presence) => {
            set({ businessPresence: presence });

            if (presence.online) {
              void markOutgoingAsDelivered(contact.chatId, 'user');
            }
          }),
        );

        set({ unsubscribers });

        const { businessPresence } = get();
        if (businessPresence.online) {
          await markOutgoingAsDelivered(contact.chatId, 'user');
        }
      } catch (err) {
        console.error('Failed to open chat:', err);
        set({
          loading: false,
          error: 'Unable to load conversation. Please try again.',
        });
      }
    },

    loadMoreMessages: async () => {
      const { chatId, oldestKey, hasMore, loadingMore, messages } = get();
      if (!chatId || !hasMore || loadingMore || !oldestKey) return;

      set({ loadingMore: true });

      try {
        const page = await fetchMessagesPage(
          chatId,
          MESSAGES_PAGE_SIZE,
          oldestKey,
        );

        set({
          messages: mergeMessages(messages, page.messages, 'prepend'),
          oldestKey: page.oldestKey ?? oldestKey,
          hasMore: page.hasMore,
          loadingMore: false,
        });
      } catch (err) {
        console.error('Failed to load older messages:', err);
        set({ loadingMore: false });
      }
    },

    sendChatMessage: async (text) => {
      const { chatId, userId, sending, businessPresence } = get();
      const trimmed = text.trim();
      if (!chatId || !userId || !trimmed || sending) return;

      set({ sending: true, draft: '' });

      try {
        const status = businessPresence.online ? 'delivered' : 'sent';
        const message = await sendMessage(
          chatId,
          userId,
          'user',
          trimmed,
          status,
        );

        set((state) => ({
          messages: mergeMessages(state.messages, [message], 'upsert'),
          newestKey: message.id,
          sending: false,
        }));
      } catch (err) {
        console.error('Failed to send message:', err);
        set({ sending: false, draft: trimmed });
      }
    },

    sendChatMedia: async (file) => {
      const { chatId, userId, sending, businessPresence, pendingUploads } = get();
      if (!chatId || !userId || sending) return;

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
          `chats/${chatId}/media`,
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

        const status = businessPresence.online ? 'delivered' : 'sent';
        const message = await sendMessage(
          chatId,
          userId,
          'user',
          getMediaPreviewLabel(uploaded.mediaType, uploaded.fileName),
          status,
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
        console.error('Failed to send media:', err);
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

    closeChat: () => {
      get().cleanup();
    },
  }),
);
