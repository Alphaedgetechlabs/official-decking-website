import { onValue, ref, type DataSnapshot, type Unsubscribe } from 'firebase/database';
import { rtdb } from '../../firebase';
import type { AppNotification } from '../../types/notification';
import { CHAT_PATHS } from '../../types/chat';
import {
  buildCandidateChatIds,
  chatMatchesUser,
  hasUnreadBusinessMessages,
  isBusinessSenderType,
  resolveBusinessId,
  type ChatMeta,
} from './chatDiscovery';

async function metaToNotification(
  chatId: string,
  meta: ChatMeta,
  authUid: string,
  docId: string | null,
): Promise<AppNotification | null> {
  if (!meta.lastMessage?.trim()) return null;
  if (!isBusinessSenderType(meta.lastSenderType)) return null;
  if (!chatMatchesUser(chatId, meta, authUid, docId)) return null;

  const businessId = resolveBusinessId(chatId, meta, authUid, docId);
  if (!businessId) return null;

  let isRead = true;
  try {
    isRead = !(await hasUnreadBusinessMessages(chatId));
  } catch {
    isRead = false;
  }

  const preview = meta.lastMessage.trim();
  const businessName = meta.businessName?.trim();

  return {
    id: `message_${chatId}`,
    type: 'message',
    title: 'New message',
    body: businessName ? `${businessName}: ${preview}` : preview,
    read: isRead,
    timestamp: meta.lastMessageAt ?? Date.now(),
    businessId,
    businessName,
    chatId,
  };
}

async function buildNotificationsFromMetaCache(
  authUid: string,
  docId: string | null,
  metaCache: Map<string, ChatMeta | null>,
): Promise<AppNotification[]> {
  const notifications = await Promise.all(
    [...metaCache.entries()].map(([chatId, meta]) =>
      meta
        ? metaToNotification(chatId, meta, authUid, docId)
        : Promise.resolve(null),
    ),
  );

  return notifications
    .filter((n): n is AppNotification => n !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function subscribeToUserNotifications(
  authUid: string,
  docId: string | null,
  businessIds: string[],
  onUpdate: (notifications: AppNotification[]) => void,
): Unsubscribe {
  const metaCache = new Map<string, ChatMeta | null>();
  const metaUnsubs = new Map<string, Unsubscribe>();
  const rootUnsubs: Unsubscribe[] = [];
  let rebuildGeneration = 0;

  const scheduleRebuild = () => {
    const generation = ++rebuildGeneration;
    void buildNotificationsFromMetaCache(authUid, docId, metaCache).then(
      (notifications) => {
        if (generation !== rebuildGeneration) return;
        onUpdate(notifications);
      },
    );
  };

  const attachMetaListener = (chatId: string) => {
    if (!chatId || metaUnsubs.has(chatId)) return;

    const unsub = onValue(
      ref(rtdb, CHAT_PATHS.meta(chatId)),
      (snapshot) => {
        metaCache.set(
          chatId,
          snapshot.exists() ? (snapshot.val() as ChatMeta) : null,
        );
        scheduleRebuild();
      },
      (error) => {
        console.warn(`meta listen failed for ${chatId}:`, error);
        metaCache.set(chatId, null);
      },
    );

    metaUnsubs.set(chatId, unsub);
  };

  const registerChatsFromIndex = (snapshot: DataSnapshot) => {
    snapshot.forEach((child) => {
      if (child.key) attachMetaListener(child.key);
    });
  };

  rootUnsubs.push(
    onValue(
      ref(rtdb, CHAT_PATHS.userChats(authUid)),
      (snapshot) => {
        registerChatsFromIndex(snapshot);
        scheduleRebuild();
      },
      (error) => console.warn('userChats listen failed:', error),
    ),
  );

  if (docId && docId !== authUid) {
    rootUnsubs.push(
      onValue(
        ref(rtdb, CHAT_PATHS.userChats(docId)),
        (snapshot) => {
          registerChatsFromIndex(snapshot);
          scheduleRebuild();
        },
        (error) => console.warn('userChats doc listen failed:', error),
      ),
    );
  }

  for (const chatId of buildCandidateChatIds(authUid, docId, businessIds)) {
    attachMetaListener(chatId);
  }

  rootUnsubs.push(
    onValue(
      ref(rtdb, 'chats'),
      (snapshot) => {
        snapshot.forEach((chatSnap) => {
          const chatId = chatSnap.key;
          if (!chatId) return;

          const chatData = chatSnap.val() as { meta?: ChatMeta } | null;
          const meta = chatData?.meta ?? {};
          if (!chatMatchesUser(chatId, meta, authUid, docId)) return;

          attachMetaListener(chatId);
        });
        scheduleRebuild();
      },
      (error) => {
        console.warn('chats root listen failed (check RTDB rules):', error);
      },
    ),
  );

  return () => {
    rootUnsubs.forEach((unsub) => unsub());
    metaUnsubs.forEach((unsub) => unsub());
    metaUnsubs.clear();
    metaCache.clear();
  };
}
