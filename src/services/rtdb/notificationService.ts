import {
  get,
  limitToLast,
  onChildAdded,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  update,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  NOTIFICATION_PATHS,
  type AppNotification,
  type CreateNotificationInput,
  type JobResponsePayload,
} from '../../types/notification';

interface RawNotification extends CreateNotificationInput {
  read: boolean;
  timestamp: number;
}

function parseNotification(id: string, value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as RawNotification;
  if (!data.title || !data.body || !data.type) return null;

  return {
    id,
    type: data.type,
    title: data.title,
    body: data.body,
    read: Boolean(data.read),
    timestamp: data.timestamp ?? Date.now(),
    businessId: data.businessId,
    businessName: data.businessName,
    chatId: data.chatId,
    jobId: data.jobId,
  };
}

function snapshotToList(snapshot: DataSnapshot): AppNotification[] {
  const items: AppNotification[] = [];
  snapshot.forEach((child) => {
    const parsed = parseNotification(child.key!, child.val());
    if (parsed) items.push(parsed);
  });
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const notificationsRef = ref(rtdb, NOTIFICATION_PATHS.user(userId));
  const newRef = push(notificationsRef);
  const id = newRef.key;
  if (!id) throw new Error('Failed to create notification id');

  const payload: RawNotification = {
    ...input,
    read: false,
    timestamp: Date.now(),
  };

  await update(ref(rtdb), {
    [NOTIFICATION_PATHS.item(userId, id)]: payload,
  });

  return { id, ...payload };
}

/**
 * Idempotent write — skips if `notificationId` already exists.
 * Used so job-response / message listeners don't duplicate on refresh.
 */
export async function createNotificationIfAbsent(
  userId: string,
  notificationId: string,
  input: CreateNotificationInput,
): Promise<AppNotification | null> {
  const path = NOTIFICATION_PATHS.item(userId, notificationId);
  const existing = await get(ref(rtdb, path));
  if (existing.exists()) return null;

  const payload: RawNotification = {
    ...input,
    read: false,
    timestamp: Date.now(),
  };

  await update(ref(rtdb), {
    [path]: payload,
  });

  return { id: notificationId, ...payload };
}

export async function fetchNotifications(
  userId: string,
  limit = 50,
): Promise<AppNotification[]> {
  const notificationsRef = ref(rtdb, NOTIFICATION_PATHS.user(userId));
  const notificationsQuery = query(
    notificationsRef,
    orderByChild('timestamp'),
    limitToLast(limit),
  );
  const snapshot = await get(notificationsQuery);
  return snapshotToList(snapshot);
}

export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void,
): Unsubscribe {
  const notificationsRef = ref(rtdb, NOTIFICATION_PATHS.user(userId));
  const notificationsQuery = query(
    notificationsRef,
    orderByChild('timestamp'),
    limitToLast(50),
  );

  return onValue(notificationsQuery, (snapshot) => {
    onUpdate(snapshotToList(snapshot));
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await update(ref(rtdb), {
    [`${NOTIFICATION_PATHS.item(userId, notificationId)}/read`]: true,
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snapshot = await get(ref(rtdb, NOTIFICATION_PATHS.user(userId)));
  if (!snapshot.exists()) return;

  const patch: Record<string, boolean> = {};
  snapshot.forEach((child) => {
    patch[`${NOTIFICATION_PATHS.item(userId, child.key!)}/read`] = true;
  });

  if (Object.keys(patch).length === 0) return;
  await update(ref(rtdb), patch);
}

export function notificationFromJobResponse(
  payload: JobResponsePayload,
): CreateNotificationInput {
  const isAccepted = payload.action === 'accepted';
  return {
    type: isAccepted ? 'job_accepted' : 'job_rejected',
    title: isAccepted ? 'Job accepted' : 'Job declined',
    body: isAccepted
      ? `${payload.businessName} accepted your ${payload.jobTitle} job.`
      : `${payload.businessName} declined your ${payload.jobTitle} job.`,
    businessId: payload.businessId,
    businessName: payload.businessName,
    jobId: payload.jobId,
  };
}

export function subscribeToJobResponses(
  userId: string,
  onResponse: (payload: JobResponsePayload, responseId: string) => void,
): Unsubscribe {
  const responsesRef = ref(rtdb, NOTIFICATION_PATHS.jobResponses(userId));

  return onChildAdded(responsesRef, (snapshot) => {
    const value = snapshot.val() as JobResponsePayload | null;
    if (!value?.businessId || !value.action) return;
    onResponse(
      {
        ...value,
        timestamp: value.timestamp ?? Date.now(),
      },
      snapshot.key!,
    );
  });
}

export function notificationFromBusinessMessage(
  businessName: string,
  preview: string,
  businessId: string,
  chatId: string,
): CreateNotificationInput {
  return {
    type: 'message',
    title: 'New message',
    body: `${businessName}: ${preview}`,
    businessId,
    businessName,
    chatId,
  };
}
