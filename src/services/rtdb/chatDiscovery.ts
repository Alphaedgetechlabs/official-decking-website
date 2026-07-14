import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase';
import { CHAT_PATHS } from '../../types/chat';

export interface ChatMeta {
  lastMessage?: string;
  lastMessageAt?: number;
  lastSenderType?: string;
  userId?: string;
  businessId?: string;
  businessName?: string;
}

export function parseBusinessIdFromChatId(
  chatId: string,
  userKey: string,
): string | null {
  const prefix = `${userKey}_`;
  if (!chatId.startsWith(prefix)) return null;
  return chatId.slice(prefix.length) || null;
}

export function chatMatchesUser(
  chatId: string,
  meta: ChatMeta,
  authUid: string,
  docId: string | null,
): boolean {
  const userKeys = [authUid, docId].filter(Boolean) as string[];

  for (const key of userKeys) {
    if (meta.userId === key) return true;
    if (parseBusinessIdFromChatId(chatId, key)) return true;
  }

  return false;
}

export function resolveBusinessId(
  chatId: string,
  meta: ChatMeta,
  authUid: string,
  docId: string | null,
): string | null {
  if (meta.businessId) return meta.businessId;

  const fromAuth = parseBusinessIdFromChatId(chatId, authUid);
  if (fromAuth) return fromAuth;

  if (docId) {
    return parseBusinessIdFromChatId(chatId, docId);
  }

  return null;
}

export function isBusinessSenderType(value: string | undefined): boolean {
  return value?.toLowerCase() === 'business';
}

export function isUserSenderType(value: string | undefined): boolean {
  return value?.toLowerCase() === 'user';
}

export async function hasUnreadBusinessMessages(chatId: string): Promise<boolean> {
  const snapshot = await get(ref(rtdb, CHAT_PATHS.messages(chatId)));
  if (!snapshot.exists()) return false;

  let hasUnread = false;
  snapshot.forEach((child) => {
    if (hasUnread) return;
    const value = child.val() as Record<string, unknown> | null;
    if (!value) return;
    if (!isBusinessSenderType(value.senderType as string | undefined)) return;
    if (value.status !== 'read') hasUnread = true;
  });

  return hasUnread;
}

export function buildCandidateChatIds(
  authUid: string,
  docId: string | null,
  businessIds: string[],
): string[] {
  const ids = new Set<string>();

  for (const businessId of businessIds) {
    ids.add(`${authUid}_${businessId}`);
    if (docId && docId !== authUid) {
      ids.add(`${docId}_${businessId}`);
    }
  }

  return [...ids];
}

export function buildChatId(userKey: string, businessId: string): string {
  return `${userKey}_${businessId}`;
}

export function chatBelongsToUserKeys(
  chatId: string,
  authUid: string,
  docId: string | null,
): boolean {
  const keys = [authUid, docId].filter(Boolean) as string[];
  return keys.some((key) => chatId.startsWith(`${key}_`));
}

export function hasConversation(meta: ChatMeta | null | undefined): boolean {
  return Boolean(meta?.lastMessage?.trim());
}

export async function fetchLatestMessagePreview(chatId: string): Promise<{
  text: string;
  timestamp: number;
  senderType: string;
} | null> {
  const snapshot = await get(ref(rtdb, CHAT_PATHS.messages(chatId)));
  if (!snapshot.exists()) return null;

  const items: Array<{
    text: string;
    timestamp: number;
    senderType: string;
    id: string;
  }> = [];

  snapshot.forEach((child) => {
    const value = child.val() as Record<string, unknown> | null;
    const text = typeof value?.text === 'string' ? value.text.trim() : '';
    if (!text) return;

    items.push({
      text,
      timestamp: typeof value?.timestamp === 'number' ? value.timestamp : 0,
      senderType:
        typeof value?.senderType === 'string' ? value.senderType : 'user',
      id: child.key ?? '',
    });
  });

  if (items.length === 0) return null;

  items.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
    return b.id.localeCompare(a.id);
  });

  const latest = items[0];
  return {
    text: latest.text,
    timestamp: latest.timestamp,
    senderType: latest.senderType,
  };
}
