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
  getBusinessDisplayMeta,
  getBusinessInitials,
} from '../utils/businessDisplay';
import { buildChatId } from '../utils/businessToMessage';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { getStoredPhoneId } from '../utils/session';

const offlinePresence: UserPresence = { online: false, last_active: null };

function conversationToMessageItem(
  conversation: InboxConversation,
  presence: UserPresence,
  now = Date.now(),
): MessageItem {
  const initials = getBusinessInitials(conversation.businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(conversation.businessName);
  const { rating } = getBusinessDisplayMeta(conversation.businessName);

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
  const { rating } = getBusinessDisplayMeta(business.businessName);

  const chatId =
    docId && docId !== authUid
      ? buildChatId(docId, business.id)
      : buildChatId(authUid, business.id);

  return {
    id: business.id,
    chatId,
    businessId: business.id,
    name: business.businessName,
    rating,
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
  }, [authReady, authUid, docId, businessIds]);

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
    const listedBusinessIds = new Set(businesses.map((b) => b.id));

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
          now,
        );
      }

      return businessWithoutConversation(business, authUid, docId, presence);
    });

    const extraConversations = rawInbox
      .filter((conversation) => !listedBusinessIds.has(conversation.businessId))
      .map((conversation) =>
        conversationToMessageItem(
          conversation,
          presenceMap[conversation.businessId] ?? offlinePresence,
          now,
        ),
      );

    return sortMessageItems([...fromBusinesses, ...extraConversations]);
  }, [businesses, rawInbox, presenceMap, authUid, docId, now]);

  return {
    messages,
    loading: loading && !hasLoaded,
    error: null as string | null,
  };
}
