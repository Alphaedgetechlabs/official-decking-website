import {
  get,
  onChildAdded,
  onChildChanged,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  ADMIN_SUPPORT_MESSAGES_PAGE_SIZE,
  ADMIN_SUPPORT_PATHS,
  type AdminSupportMediaPayload,
  type AdminSupportMessage,
  type AdminSupportMessageStatus,
  type AdminSupportSender,
} from '../../types/adminSupportChat';

interface RawAdminSupportMessage {
  text: string;
  sender: AdminSupportSender;
  timestamp: unknown;
  status: AdminSupportMessageStatus;
  mediaUrl?: string;
  mediaType?: AdminSupportMediaPayload['mediaType'];
  thumbnailUrl?: string;
  fileName?: string;
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return Date.now();
}

function parseMessage(snapshot: DataSnapshot): AdminSupportMessage | null {
  const value = snapshot.val() as RawAdminSupportMessage | null;
  if (!value?.sender || (!value.text && !value.mediaUrl)) return null;

  return {
    id: snapshot.key ?? '',
    text: value.text ?? '',
    sender: value.sender,
    timestamp: parseTimestamp(value.timestamp),
    status: value.status ?? 'sent',
    ...(value.mediaUrl && { mediaUrl: value.mediaUrl }),
    ...(value.mediaType && { mediaType: value.mediaType }),
    ...(value.thumbnailUrl && { thumbnailUrl: value.thumbnailUrl }),
    ...(value.fileName && { fileName: value.fileName }),
  };
}

function snapshotToMessages(snapshot: DataSnapshot): AdminSupportMessage[] {
  const messages: AdminSupportMessage[] = [];
  snapshot.forEach((child) => {
    const parsed = parseMessage(child);
    if (parsed) messages.push(parsed);
  });
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export interface AdminSupportMessagesPage {
  messages: AdminSupportMessage[];
  oldestKey: string | null;
  newestKey: string | null;
  hasMore: boolean;
}

function paginateMessagesByKey(
  allMessages: AdminSupportMessage[],
  pageSize: number,
  endBeforeKey?: string | null,
): AdminSupportMessagesPage {
  const sorted = [...allMessages].sort((a, b) => a.id.localeCompare(b.id));

  const eligible = endBeforeKey
    ? sorted.filter((message) => message.id < endBeforeKey)
    : sorted;

  const hasMore = eligible.length > pageSize;
  const messages = eligible.slice(-pageSize);

  if (messages.length === 0) {
    return {
      messages: [],
      oldestKey: null,
      newestKey: null,
      hasMore: false,
    };
  }

  return {
    messages,
    oldestKey: messages[0]?.id ?? null,
    newestKey: messages[messages.length - 1]?.id ?? null,
    hasMore,
  };
}

export async function fetchAdminSupportMessagesPage(
  userId: string,
  pageSize = ADMIN_SUPPORT_MESSAGES_PAGE_SIZE,
  endBeforeKey?: string | null,
): Promise<AdminSupportMessagesPage> {
  const snapshot = await get(ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId)));
  const allMessages = snapshotToMessages(snapshot);
  return paginateMessagesByKey(allMessages, pageSize, endBeforeKey);
}

export function subscribeToRecentAdminSupportMessages(
  userId: string,
  pageSize: number,
  onUpdate: (page: AdminSupportMessagesPage) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));

  return onValue(messagesRef, (snapshot) => {
    const allMessages = snapshotToMessages(snapshot);
    onUpdate(paginateMessagesByKey(allMessages, pageSize));
  });
}

export async function sendAdminSupportMessage(
  userId: string,
  text: string,
  media?: AdminSupportMediaPayload,
): Promise<AdminSupportMessage> {
  const trimmed = text.trim();
  if (!trimmed && !media) throw new Error('Message cannot be empty');

  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));
  const newRef = push(messagesRef);
  const messageId = newRef.key;
  if (!messageId) throw new Error('Failed to create message id');

  const payload = {
    text: trimmed,
    sender: 'user' as const,
    timestamp: serverTimestamp(),
    status: 'sent' as const,
    ...(media?.mediaUrl && { mediaUrl: media.mediaUrl }),
    ...(media?.mediaType && { mediaType: media.mediaType }),
    ...(media?.thumbnailUrl && { thumbnailUrl: media.thumbnailUrl }),
    ...(media?.fileName && { fileName: media.fileName }),
  };

  await set(newRef, payload);

  return {
    id: messageId,
    text: trimmed,
    sender: 'user',
    timestamp: Date.now(),
    status: 'sent',
    ...(media?.mediaUrl && { mediaUrl: media.mediaUrl }),
    ...(media?.mediaType && { mediaType: media.mediaType }),
    ...(media?.thumbnailUrl && { thumbnailUrl: media.thumbnailUrl }),
    ...(media?.fileName && { fileName: media.fileName }),
  };
}

const FIRST_JOB_WELCOME_TEXT =
  'Welcome to QuoteMyFence! 👋 Your first job has been posted successfully. If you have any questions or need help, feel free to ask me here!';

/**
 * Sends a one-time admin welcome message after a user's first job post.
 * Skips if the support chat already has messages.
 */
export async function maybeSendFirstJobWelcomeMessage(
  userId: string,
): Promise<void> {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));
  const snapshot = await get(messagesRef);
  if (snapshot.exists()) return;

  const newRef = push(messagesRef);
  if (!newRef.key) return;

  await set(newRef, {
    text: FIRST_JOB_WELCOME_TEXT,
    sender: 'admin' as const,
    timestamp: serverTimestamp(),
    status: 'sent' as const,
  });
}

export async function markAdminMessageAsDelivered(
  userId: string,
  messageId: string,
): Promise<void> {
  const messageRef = ref(
    rtdb,
    `${ADMIN_SUPPORT_PATHS.messages(userId)}/${messageId}`,
  );
  const snapshot = await get(messageRef);
  if (!snapshot.exists()) return;

  const value = snapshot.val() as RawAdminSupportMessage;
  if (value.sender !== 'admin' || value.status !== 'sent') return;

  await update(ref(rtdb), {
    [`${ADMIN_SUPPORT_PATHS.messages(userId)}/${messageId}/status`]: 'delivered',
  });
}

export async function markAdminMessageAsSeen(
  userId: string,
  messageId: string,
): Promise<void> {
  const messageRef = ref(
    rtdb,
    `${ADMIN_SUPPORT_PATHS.messages(userId)}/${messageId}`,
  );
  const snapshot = await get(messageRef);
  if (!snapshot.exists()) return;

  const value = snapshot.val() as RawAdminSupportMessage;
  if (value.sender !== 'admin' || value.status !== 'delivered') return;

  await update(ref(rtdb), {
    [`${ADMIN_SUPPORT_PATHS.messages(userId)}/${messageId}/status`]: 'seen',
  });
}

export async function markAdminMessagesAsDelivered(
  userId: string,
): Promise<void> {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));
  const snapshot = await get(messagesRef);
  if (!snapshot.exists()) return;

  const patch: Record<string, unknown> = {};
  const basePath = ADMIN_SUPPORT_PATHS.messages(userId);

  snapshot.forEach((child) => {
    const value = child.val() as RawAdminSupportMessage;
    if (value.sender === 'admin' && value.status === 'sent') {
      patch[`${basePath}/${child.key}/status`] = 'delivered';
    }
  });

  if (Object.keys(patch).length === 0) return;
  await update(ref(rtdb), patch);
}

export async function markAdminMessagesAsSeen(userId: string): Promise<void> {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));
  const snapshot = await get(messagesRef);
  if (!snapshot.exists()) return;

  const patch: Record<string, unknown> = {};
  const basePath = ADMIN_SUPPORT_PATHS.messages(userId);

  snapshot.forEach((child) => {
    const value = child.val() as RawAdminSupportMessage;
    if (
      value.sender === 'admin' &&
      (value.status === 'sent' || value.status === 'delivered')
    ) {
      patch[`${basePath}/${child.key}/status`] = 'seen';
    }
  });

  if (Object.keys(patch).length === 0) return;
  await update(ref(rtdb), patch);
}

export function subscribeToNewAdminSupportMessages(
  userId: string,
  afterKey: string | null,
  onMessage: (message: AdminSupportMessage) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));

  return onChildAdded(messagesRef, (snapshot) => {
    if (afterKey && snapshot.key! <= afterKey) return;
    const parsed = parseMessage(snapshot);
    if (parsed) onMessage(parsed);
  });
}

export function subscribeToAdminSupportMessageUpdates(
  userId: string,
  onUpdate: (message: AdminSupportMessage) => void,
): Unsubscribe {
  const messagesRef = ref(rtdb, ADMIN_SUPPORT_PATHS.messages(userId));

  return onChildChanged(messagesRef, (snapshot) => {
    const parsed = parseMessage(snapshot);
    if (parsed) onUpdate(parsed);
  });
}
