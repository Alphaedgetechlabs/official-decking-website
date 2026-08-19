import {
  endBefore,
  get,
  limitToLast,
  onChildAdded,
  onChildChanged,
  orderByKey,
  push,
  query,
  ref,
  set,
  update,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  CHAT_PATHS,
  MESSAGES_PAGE_SIZE,
  type ChatMediaPayload,
  type MessageStatus,
  type RtdbChatMessage,
  type SenderType,
} from '../../types/chat';

interface RawMessage {
  senderId: string;
  senderType: SenderType;
  text: string;
  timestamp: number;
  status: MessageStatus;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  fileName?: string;
}

function normalizeMediaType(
  mediaType: string | undefined,
): ChatMediaPayload['mediaType'] | undefined {
  if (!mediaType) return undefined;
  if (mediaType === 'image' || mediaType === 'video') return mediaType;
  if (mediaType === 'document' || mediaType === 'file' || mediaType === 'doc') {
    return 'document';
  }
  return undefined;
}

function parseMessage(snapshot: DataSnapshot): RtdbChatMessage | null {
  const value = snapshot.val() as RawMessage | null;
  if (!value || (!value.text && !value.mediaUrl)) return null;

  const mediaType = normalizeMediaType(value.mediaType);
  const thumbnailUrl = value.thumbnailUrl || value.thumbnail;

  return {
    id: snapshot.key ?? '',
    senderId: value.senderId,
    senderType: value.senderType,
    text: value.text ?? '',
    timestamp: value.timestamp ?? Date.now(),
    status: value.status ?? 'sent',
    ...(value.mediaUrl && { mediaUrl: value.mediaUrl }),
    ...(mediaType && { mediaType }),
    ...(thumbnailUrl && { thumbnailUrl }),
    ...(value.fileName && { fileName: value.fileName }),
  };
}

function snapshotToMessages(snapshot: DataSnapshot): RtdbChatMessage[] {
  const messages: RtdbChatMessage[] = [];
  snapshot.forEach((child) => {
    const parsed = parseMessage(child);
    if (parsed) messages.push(parsed);
  });
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export interface MessagesPage {
  messages: RtdbChatMessage[];
  oldestKey: string | null;
  newestKey: string | null;
  hasMore: boolean;
}

export async function fetchMessagesPage(
  chatId: string,
  pageSize = MESSAGES_PAGE_SIZE,
  endBeforeKey?: string | null,
): Promise<MessagesPage> {
  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));

  const messagesQuery = endBeforeKey
    ? query(
        messagesRef,
        orderByKey(),
        endBefore(endBeforeKey),
        limitToLast(pageSize),
      )
    : query(messagesRef, orderByKey(), limitToLast(pageSize));

  const snapshot = await get(messagesQuery);
  const messages = snapshotToMessages(snapshot);

  if (messages.length === 0) {
    return {
      messages: [],
      oldestKey: null,
      newestKey: null,
      hasMore: false,
    };
  }

  const keys = messages.map((m) => m.id);
  const oldestKey = keys[0] ?? null;
  const newestKey = keys[keys.length - 1] ?? null;

  let hasMore = false;
  if (oldestKey) {
    const olderQuery = query(
      messagesRef,
      orderByKey(),
      endBefore(oldestKey),
      limitToLast(1),
    );
    const olderSnap = await get(olderQuery);
    hasMore = olderSnap.exists();
  }

  return { messages, oldestKey, newestKey, hasMore };
}

export async function ensureChatMeta(
  chatId: string,
  meta: { userId: string; businessId: string; businessName: string },
): Promise<void> {
  const payload = {
    ...meta,
    updatedAt: Date.now(),
  };

  await update(ref(rtdb), {
    [CHAT_PATHS.meta(chatId)]: payload,
    [CHAT_PATHS.userChatIndex(meta.userId, chatId)]: true,
  });
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  senderType: SenderType,
  text: string,
  initialStatus: MessageStatus = 'sent',
  media?: ChatMediaPayload,
): Promise<RtdbChatMessage> {
  const trimmed = text.trim();
  if (!trimmed && !media) throw new Error('Message cannot be empty');

  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));
  const newRef = push(messagesRef);
  const messageId = newRef.key;
  if (!messageId) throw new Error('Failed to create message id');

  const payload: RawMessage = {
    senderId,
    senderType,
    text: trimmed,
    timestamp: Date.now(),
    status: initialStatus,
    ...(media?.mediaUrl && { mediaUrl: media.mediaUrl }),
    ...(media?.mediaType && { mediaType: media.mediaType }),
    ...(media?.thumbnailUrl && { thumbnailUrl: media.thumbnailUrl }),
    ...(media?.fileName && { fileName: media.fileName }),
  };

  await set(newRef, payload);

  const lastMessagePreview =
    trimmed ||
    (media?.mediaType === 'image'
      ? 'Photo'
      : media?.mediaType === 'video'
        ? 'Video'
        : media?.fileName ?? 'Document');

  await update(ref(rtdb, CHAT_PATHS.meta(chatId)), {
    lastMessage: lastMessagePreview,
    lastMessageAt: payload.timestamp,
    lastSenderType: senderType,
  });

  return { id: messageId, ...payload };
}

export async function markMessagesAsRead(
  chatId: string,
  readerType: SenderType,
): Promise<void> {
  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));
  const snapshot = await get(messagesRef);
  if (!snapshot.exists()) return;

  const updates: Record<string, MessageStatus> = {};

  snapshot.forEach((child) => {
    const value = child.val() as RawMessage;
    if (value.senderType !== readerType && value.status !== 'read') {
      updates[child.key!] = 'read';
    }
  });

  if (Object.keys(updates).length === 0) return;

  const patch: Record<string, unknown> = {};
  for (const [messageId, status] of Object.entries(updates)) {
    patch[`${CHAT_PATHS.messages(chatId)}/${messageId}/status`] = status;
  }

  await update(ref(rtdb), patch);
}

export async function markOutgoingAsDelivered(
  chatId: string,
  senderType: SenderType,
): Promise<void> {
  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));
  const snapshot = await get(messagesRef);
  if (!snapshot.exists()) return;

  const patch: Record<string, unknown> = {};

  snapshot.forEach((child) => {
    const value = child.val() as RawMessage;
    if (value.senderType === senderType && value.status === 'sent') {
      patch[`${CHAT_PATHS.messages(chatId)}/${child.key}/status`] = 'delivered';
    }
  });

  if (Object.keys(patch).length === 0) return;
  await update(ref(rtdb), patch);
}

export function subscribeToNewMessages(
  chatId: string,
  afterKey: string | null,
  onMessage: (message: RtdbChatMessage) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));

  return onChildAdded(messagesRef, (snapshot) => {
    if (afterKey && snapshot.key! <= afterKey) return;
    const parsed = parseMessage(snapshot);
    if (parsed) onMessage(parsed);
  });
}

export function subscribeToMessageUpdates(
  chatId: string,
  onUpdate: (message: RtdbChatMessage) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, CHAT_PATHS.messages(chatId));

  return onChildChanged(messagesRef, (snapshot) => {
    const parsed = parseMessage(snapshot);
    if (parsed) onUpdate(parsed);
  });
}

export async function updateMessageStatus(
  chatId: string,
  messageId: string,
  status: MessageStatus,
): Promise<void> {
  await update(ref(rtdb), {
    [`${CHAT_PATHS.messages(chatId)}/${messageId}/status`]: status,
  });
}
