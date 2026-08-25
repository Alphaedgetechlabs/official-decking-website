import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { rtdb } from '../../firebase';
import { CHAT_PATHS } from '../../types/chat';
import {
  buildCandidateChatIds,
  chatBelongsToUserKeys,
  chatMatchesUser,
  fetchLatestMessagePreview,
  hasUnreadBusinessMessages,
  resolveBusinessId,
  type ChatMeta,
} from './chatDiscovery';

export interface InboxConversation {
  chatId: string;
  businessId: string;
  businessName: string;
  preview: string;
  lastMessageAt: number;
  lastSenderType: string;
  unread: boolean;
}

async function buildConversationFromChat(
  chatId: string,
  meta: ChatMeta | null,
  authUid: string,
  docId: string | null,
): Promise<InboxConversation | null> {
  try {
    const belongsToUser =
      chatBelongsToUserKeys(chatId, authUid, docId) ||
      (meta ? chatMatchesUser(chatId, meta, authUid, docId) : false);

    if (!belongsToUser) return null;

    const businessId = resolveBusinessId(chatId, meta ?? {}, authUid, docId);
    if (!businessId) return null;

    let preview = meta?.lastMessage?.trim() ?? '';
    let lastMessageAt = meta?.lastMessageAt ?? 0;
    let lastSenderType = meta?.lastSenderType ?? 'user';
    let latest: Awaited<ReturnType<typeof fetchLatestMessagePreview>> = null;

    // Prefer meta for the list; only hit messages/ when preview is missing.
    if (!preview) {
      latest = await fetchLatestMessagePreview(chatId);
      if (latest) {
        preview = latest.text;
        lastMessageAt = latest.timestamp;
        lastSenderType = latest.senderType;
      }
    }

    if (!preview) return null;

    let unread = false;
    try {
      unread = await hasUnreadBusinessMessages(chatId);
    } catch {
      unread = false;
    }

    return {
      chatId,
      businessId,
      businessName: meta?.businessName?.trim() || 'Trady',
      preview,
      lastMessageAt: lastMessageAt || latest?.timestamp || Date.now(),
      lastSenderType,
      unread,
    };
  } catch {
    // One denied/failed chat must not block the whole inbox rebuild.
    return null;
  }
}

async function buildInboxFromMetaCache(
  authUid: string,
  docId: string | null,
  metaCache: Map<string, ChatMeta | null>,
  businessIds: string[],
): Promise<InboxConversation[]> {
  const chatIds = new Set(metaCache.keys());

  for (const chatId of buildCandidateChatIds(authUid, docId, businessIds)) {
    chatIds.add(chatId);
  }

  const conversations = await Promise.all(
    [...chatIds].map((chatId) =>
      buildConversationFromChat(chatId, metaCache.get(chatId) ?? null, authUid, docId),
    ),
  );

  const byBusiness = new Map<string, InboxConversation>();

  for (const conversation of conversations) {
    if (!conversation) continue;
    const existing = byBusiness.get(conversation.businessId);
    if (!existing || conversation.lastMessageAt > existing.lastMessageAt) {
      byBusiness.set(conversation.businessId, conversation);
    }
  }

  return [...byBusiness.values()].sort(
    (a, b) => b.lastMessageAt - a.lastMessageAt,
  );
}

export function subscribeToConversationInbox(
  authUid: string,
  docId: string | null,
  businessIds: string[],
  onUpdate: (conversations: InboxConversation[]) => void,
): Unsubscribe {
  const metaCache = new Map<string, ChatMeta | null>();
  const metaUnsubs = new Map<string, Unsubscribe>();
  const messageUnsubs = new Map<string, Unsubscribe>();
  const rootUnsubs: Unsubscribe[] = [];
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let rebuildInFlight = false;
  let rebuildQueued = false;

  const runRebuild = () => {
    if (rebuildInFlight) {
      rebuildQueued = true;
      return;
    }

    rebuildInFlight = true;
    void buildInboxFromMetaCache(authUid, docId, metaCache, businessIds)
      .then((conversations) => {
        onUpdate(conversations);
      })
      .catch(() => {
        onUpdate([]);
      })
      .finally(() => {
        rebuildInFlight = false;
        if (rebuildQueued) {
          rebuildQueued = false;
          runRebuild();
        }
      });
  };

  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      runRebuild();
    }, 80);
  };

  const attachMetaListener = (chatId: string) => {
    if (!chatId || metaUnsubs.has(chatId)) return;

    if (!metaCache.has(chatId)) {
      metaCache.set(chatId, null);
    }

    const unsub = onValue(
      ref(rtdb, CHAT_PATHS.meta(chatId)),
      (snapshot) => {
        metaCache.set(
          chatId,
          snapshot.exists() ? (snapshot.val() as ChatMeta) : null,
        );
        scheduleRebuild();
      },
      () => {
        metaCache.set(chatId, null);
        scheduleRebuild();
      },
    );

    metaUnsubs.set(chatId, unsub);

    if (!messageUnsubs.has(chatId)) {
      messageUnsubs.set(
        chatId,
        onValue(ref(rtdb, CHAT_PATHS.messages(chatId)), () => {
          scheduleRebuild();
        }),
      );
    }
  };

  const registerChatsFromIndex = (snapshot: {
    forEach: (fn: (child: { key: string | null }) => void) => void;
  }) => {
    snapshot.forEach((child) => {
      if (child.key) attachMetaListener(child.key);
    });
  };

  rootUnsubs.push(
    onValue(ref(rtdb, CHAT_PATHS.userChats(authUid)), (snapshot) => {
      registerChatsFromIndex(snapshot);
      scheduleRebuild();
    }),
  );

  if (docId && docId !== authUid) {
    rootUnsubs.push(
      onValue(ref(rtdb, CHAT_PATHS.userChats(docId)), (snapshot) => {
        registerChatsFromIndex(snapshot);
        scheduleRebuild();
      }),
    );
  }

  for (const chatId of buildCandidateChatIds(authUid, docId, businessIds)) {
    attachMetaListener(chatId);
  }

  scheduleRebuild();

  return () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rootUnsubs.forEach((unsub) => unsub());
    metaUnsubs.forEach((unsub) => unsub());
    messageUnsubs.forEach((unsub) => unsub());
    metaUnsubs.clear();
    messageUnsubs.clear();
    metaCache.clear();
  };
}
