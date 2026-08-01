import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import { CHAT_PATHS } from '../../types/chat';
import type { BusinessProfile } from '../businessService';
import { subscribeToNewMessages } from './chatService';
import {
  createNotificationIfAbsent,
  notificationFromBusinessMessage,
} from './notificationService';
import { buildChatId } from '../../utils/businessToMessage';

type Unsubscribe = () => void;

function chatIdsForBusiness(
  authUid: string,
  userDocId: string | null | undefined,
  businessId: string,
): string[] {
  const ids = new Set<string>([buildChatId(authUid, businessId)]);
  const docId = userDocId?.trim();
  if (docId && docId !== authUid) {
    ids.add(buildChatId(docId, businessId));
  }
  return [...ids];
}

/**
 * Listens for new business messages across the user's active chats
 * and creates persistent RTDB notifications (deduped by message id).
 */
export function subscribeToBusinessMessageNotifications(
  userId: string,
  businesses: BusinessProfile[],
  options?: {
    userDocId?: string | null;
    shouldSkipChat?: (chatId: string) => boolean;
    onNotificationCreated?: () => void;
  },
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  let cancelled = false;

  void (async () => {
    for (const business of businesses) {
      if (cancelled) return;

      const chatIds = chatIdsForBusiness(
        userId,
        options?.userDocId,
        business.id,
      );

      for (const chatId of chatIds) {
        if (cancelled) return;

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
          if (!message.id) return;

          const preview =
            message.text?.trim() ||
            (message.mediaUrl ? 'Sent an attachment' : '');
          if (!preview) return;

          void createNotificationIfAbsent(
            userId,
            `msg_${chatId}_${message.id}`,
            notificationFromBusinessMessage(
              business.businessName,
              preview,
              business.id,
              chatId,
            ),
          )
            .then((created) => {
              if (created) options?.onNotificationCreated?.();
            })
            .catch((err) => {
              console.error('Failed to create message notification:', err);
            });
        });

        unsubs.push(unsub);
      }
    }
  })();

  return () => {
    cancelled = true;
    unsubs.forEach((unsub) => unsub());
  };
}
