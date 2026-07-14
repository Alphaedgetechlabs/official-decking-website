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
import { CHAT_PATHS, type UserPresence } from '../../types/chat';

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function parsePresence(value: unknown): UserPresence {
  if (!value || typeof value !== 'object') {
    return { online: false, last_active: null };
  }

  const data = value as Record<string, unknown>;
  return {
    online: data.online === true,
    last_active: parseTimestamp(data.last_active),
  };
}

let presenceInitializedFor: string | null = null;
let presenceUnsubscribe: Unsubscribe | null = null;

export async function setOfflinePresence(userId: string): Promise<void> {
  if (!userId || auth.currentUser?.uid !== userId) return;

  const statusRef = ref(rtdb, CHAT_PATHS.status(userId));
  await set(statusRef, {
    online: false,
    last_active: serverTimestamp(),
  });
}

export async function setOnlinePresence(userId: string): Promise<void> {
  if (!userId || auth.currentUser?.uid !== userId) return;

  const statusRef = ref(rtdb, CHAT_PATHS.status(userId));

  await onDisconnect(statusRef).set({
    online: false,
    last_active: serverTimestamp(),
  });

  await set(statusRef, {
    online: true,
    last_active: serverTimestamp(),
  });
}

/**
 * Tracks the current user's online state via `.info/connected`.
 * Writes to `status/{authUid}` — must match RTDB rules (`auth.uid == $uid`).
 */
export function initUserPresence(userId: string): void {
  if (!userId) return;
  if (auth.currentUser?.uid !== userId) {
    console.warn('Presence init skipped: Firebase Auth uid mismatch.');
    return;
  }
  if (presenceInitializedFor === userId) return;

  presenceUnsubscribe?.();
  presenceInitializedFor = userId;

  const connectedRef = ref(rtdb, '.info/connected');
  const statusRef = ref(rtdb, CHAT_PATHS.status(userId));

  presenceUnsubscribe = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() !== true) return;
    if (auth.currentUser?.uid !== userId) return;

    void onDisconnect(statusRef)
      .set({
        online: false,
        last_active: serverTimestamp(),
      })
      .then(() =>
        set(statusRef, {
          online: true,
          last_active: serverTimestamp(),
        }),
      )
      .catch((err) => {
        console.error('Failed to update user presence:', err);
      });
  });
}

export function teardownUserPresence(): void {
  const userId = presenceInitializedFor;

  presenceUnsubscribe?.();
  presenceUnsubscribe = null;
  presenceInitializedFor = null;

  if (userId) {
    void setOfflinePresence(userId).catch((err) => {
      console.error('Failed to set offline presence on teardown:', err);
    });
  }
}

export function subscribeToPresence(
  userId: string,
  onUpdate: (presence: UserPresence) => void,
): Unsubscribe {
  const statusRef = ref(rtdb, CHAT_PATHS.status(userId));

  return onValue(statusRef, (snapshot) => {
    onUpdate(parsePresence(snapshot.val()));
  });
}

export async function fetchPresence(userId: string): Promise<UserPresence> {
  const snapshot = await get(ref(rtdb, CHAT_PATHS.status(userId)));
  return parsePresence(snapshot.val());
}
