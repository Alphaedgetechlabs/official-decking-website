import {
  get,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { auth, rtdb } from '../../firebase';
import {
  ADMIN_SUPPORT_PATHS,
  type AdminSupportPresence,
} from '../../types/adminSupportChat';

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function parsePresence(value: unknown): AdminSupportPresence {
  if (!value || typeof value !== 'object') {
    return { isOnline: false, lastSeen: null };
  }

  const data = value as Record<string, unknown>;
  return {
    isOnline: data.isOnline === true || data.online === true,
    lastSeen:
      parseTimestamp(data.lastSeen) ?? parseTimestamp(data.last_active),
  };
}

function presencePayload(online: boolean) {
  if (online) {
    return {
      online: true,
      isOnline: true,
    };
  }

  return {
    online: false,
    isOnline: false,
    lastSeen: serverTimestamp(),
  };
}

let presenceInitializedFor: string | null = null;
let presenceUnsubscribe: Unsubscribe | null = null;

export async function setAdminSupportOffline(userDocId: string): Promise<void> {
  if (!userDocId || !auth.currentUser) return;

  const presenceRef = ref(rtdb, ADMIN_SUPPORT_PATHS.userPresence(userDocId));
  await set(presenceRef, presencePayload(false));
}

/**
 * Tracks user presence at `adminSupportChats/presence/{userDocId}`.
 * Uses the phone-based Firestore doc ID to match the admin dashboard.
 */
export function initAdminSupportUserPresence(userDocId: string): void {
  if (!userDocId) return;
  if (!auth.currentUser) {
    console.warn('Admin support presence init skipped: not authenticated.');
    return;
  }
  if (presenceInitializedFor === userDocId) return;

  presenceUnsubscribe?.();
  presenceInitializedFor = userDocId;

  const connectedRef = ref(rtdb, '.info/connected');
  const presenceRef = ref(rtdb, ADMIN_SUPPORT_PATHS.userPresence(userDocId));

  presenceUnsubscribe = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() !== true) return;
    if (!auth.currentUser) return;

    void onDisconnect(presenceRef)
      .set(presencePayload(false))
      .then(() => set(presenceRef, presencePayload(true)))
      .catch((err) => {
        console.error('Failed to update admin support presence:', err);
      });
  });
}

export function teardownAdminSupportUserPresence(): void {
  const userDocId = presenceInitializedFor;

  presenceUnsubscribe?.();
  presenceUnsubscribe = null;
  presenceInitializedFor = null;

  if (userDocId) {
    void setAdminSupportOffline(userDocId).catch((err) => {
      console.error('Failed to set admin support offline on teardown:', err);
    });
  }
}

export function subscribeToAdminPresence(
  onUpdate: (presence: AdminSupportPresence) => void,
): Unsubscribe {
  const presenceRef = ref(rtdb, ADMIN_SUPPORT_PATHS.adminPresence);

  return onValue(presenceRef, (snapshot) => {
    onUpdate(parsePresence(snapshot.val()));
  });
}

export async function fetchAdminPresence(): Promise<AdminSupportPresence> {
  const snapshot = await get(ref(rtdb, ADMIN_SUPPORT_PATHS.adminPresence));
  return parsePresence(snapshot.val());
}
