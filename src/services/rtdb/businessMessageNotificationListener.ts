import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import { CHAT_PATHS } from '../../types/chat';
import type { BusinessProfile } from '../businessService';
import { subscribeToNewMessages } from './chatService';
import {
  createNotification,
  notificationFromBusinessMessage,
} from './notificationService';
import { buildChatId } from '../../utils/businessToMessage';

type Unsubscribe = () => void;

/**
 * Listens for new business messages across the user's active chats
 * and creates notifications (for when Flutter business sends a message).
 */
export function subscribeToBusinessMessageNotifications(
  userId: string,
  businesses: BusinessProfile[],
  options?: {
    shouldSkipChat?: (chatId: string) => boolean;
    onNotificationCreated?: () => void;
  },
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  let cancelled = false;

  void (async () => {
    for (const business of businesses) {
      if (cancelled) return;

      const chatId = buildChatId(userId, business.id);
      const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));

      let newestKey: string | null = null;
      try {
        const snap = await get(messagesRef);
        if (snap.exists()) {
          let lastKey: string | null = null;
          snap.forEach((child) => {
            lastKey = child.key;
          });
          newestKey = lastKey;
        }
      } catch {
        newestKey = null;
      }

      const unsub = subscribeToNewMessages(chatId, newestKey, (message) => {
        if (message.senderType !== 'business') return;
        if (options?.shouldSkipChat?.(chatId)) return;

        void createNotification(
          userId,
          notificationFromBusinessMessage(
            business.businessName,
            message.text,
            business.id,
            chatId,
          ),
        ).then(() => options?.onNotificationCreated?.());
      });

      unsubs.push(unsub);
    }
  })();

  return () => {
    cancelled = true;
    unsubs.forEach((unsub) => unsub());
  };
}
