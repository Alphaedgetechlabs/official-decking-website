import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { MessageItem } from '../data/messages';
import { auth } from '../firebase';
import type { BusinessProfile } from '../services/businessService';
import {
  subscribeToConversationInbox,
  type InboxConversation,
} from '../services/rtdb/conversationInboxService';
import { subscribeToPresence } from '../services/rtdb/presenceService';
import type { UserPresence } from '../types/chat';
import {
  getBusinessAvatarStyle,
  getBusinessInitials,
} from '../utils/businessDisplay';
import { buildChatId } from '../utils/businessToMessage';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { getStoredPhoneId } from '../utils/session';

const offlinePresence: UserPresence = { online: false, last_active: null };

function conversationToMessageItem(
  conversation: InboxConversation,
  presence: UserPresence,
  rating: number,
  now = Date.now(),
): MessageItem {
  const initials = getBusinessInitials(conversation.businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(conversation.businessName);

  const unread = conversation.unread;

  return {
    id: conversation.businessId,
    chatId: conversation.chatId,
    businessId: conversation.businessId,
    name: conversation.businessName,
    rating,
    time: conversation.lastMessageAt
      ? formatRelativeTime(conversation.lastMessageAt, now)
      : '',
    preview: conversation.preview,
    status: unread ? 'Unread' : 'Read',
    unread,
    isOnline: presence.online,
    lastMessageAt: conversation.lastMessageAt,
    hasConversation: true,
    initials,
    avatarBg,
    avatarText,
  };
}

function businessWithoutConversation(
  business: BusinessProfile,
  authUid: string,
  docId: string | null,
  presence: UserPresence,
): MessageItem {
  const initials = getBusinessInitials(business.businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(business.businessName);

  const chatId =
    docId && docId !== authUid
      ? buildChatId(docId, business.id)
      : buildChatId(authUid, business.id);

  return {
    id: business.id,
    chatId,
    businessId: business.id,
    name: business.businessName,
    rating: business.rating || 0,
    time: '',
    preview: 'No conversation',
    status: '',
    unread: false,
    isOnline: presence.online,
    hasConversation: false,
    initials,
    avatarBg,
    avatarText,
  };
}

function sortMessageItems(items: MessageItem[]): MessageItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.lastMessageAt ?? 0;
    const bTime = b.lastMessageAt ?? 0;

    if (aTime !== bTime) return bTime - aTime;

    if (a.hasConversation && !b.hasConversation) return -1;
    if (!a.hasConversation && b.hasConversation) return 1;

    return a.name.localeCompare(b.name);
  });
}

export function useConversationInbox(
  authUid: string,
  userDocId: string | null | undefined,
  businesses: BusinessProfile[],
) {
  const [authReady, setAuthReady] = useState(() => !!auth.currentUser);
  const [rawInbox, setRawInbox] = useState<InboxConversation[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const docId = userDocId?.trim() || getStoredPhoneId();
  const businessIds = useMemo(
    () => businesses.map((business) => business.id),
    [businesses],
  );
  // Stabilize effect deps — new array identity alone must not resubscribe.
  const businessIdsKey = businessIds.join(',');

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setAuthReady(!!user));
  }, []);

  useEffect(() => {
    if (!authReady || !authUid) {
      setRawInbox([]);
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    setHasLoaded(false);

    const unsub = subscribeToConversationInbox(
      authUid,
      docId,
      businessIds,
      (conversations) => {
        setRawInbox(conversations);
        setLoading(false);
        setHasLoaded(true);
      },
    );

    return unsub;
    // businessIdsKey tracks id membership; businessIds read from latest render via key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid array-identity thrash
  }, [authReady, authUid, docId, businessIdsKey]);

  useEffect(() => {
    const trackedIds = new Set([
      ...businesses.map((b) => b.id),
      ...rawInbox.map((c) => c.businessId),
    ]);
    const unsubs: Array<() => void> = [];

    for (const businessId of trackedIds) {
      unsubs.push(
        subscribeToPresence(businessId, (presence) => {
          setPresenceMap((prev) => ({ ...prev, [businessId]: presence }));
        }),
      );
    }

    return () => unsubs.forEach((unsub) => unsub());
  }, [businesses, rawInbox]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const messages = useMemo(() => {
    const inboxByBusinessId = new Map(
      rawInbox.map((conversation) => [conversation.businessId, conversation]),
    );

    // Only accepted businesses — never pad with unmatched / random chats.
    const fromBusinesses = businesses.map((business) => {
      const conversation = inboxByBusinessId.get(business.id);
      const presence = presenceMap[business.id] ?? offlinePresence;

      if (conversation) {
        return conversationToMessageItem(
          {
            ...conversation,
            businessName: conversation.businessName || business.businessName,
          },
          presence,
          business.rating || 0,
          now,
        );
      }

      return businessWithoutConversation(business, authUid, docId, presence);
    });

    return sortMessageItems(fromBusinesses);
  }, [businesses, rawInbox, presenceMap, authUid, docId, now]);

  return {
    messages,
    loading: loading && !hasLoaded,
    error: null as string | null,
  };
}
