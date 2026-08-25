import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useDashboardStore } from '../stores/dashboardStore';
import type { UserDocument } from '../types/user';
import { getStoredPhoneId } from '../utils/session';
import { sanitizePhone } from '../utils/phone';

async function fetchByUid(uid: string): Promise<UserDocument | null> {
  const uidQuery = query(collection(db, 'users'), where('uid', '==', uid));
  const snapshot = await getDocs(uidQuery);
  if (!snapshot.empty) {
    return snapshot.docs[0].data() as UserDocument;
  }
  return null;
}

async function fetchByPhoneId(phoneId: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, 'users', phoneId));
  if (snap.exists()) {
    return snap.data() as UserDocument;
  }
  return null;
}

export function useDashboardUser() {
  const cachedUser = useDashboardStore((s) => s.user);
  const [user, setUser] = useState<UserDocument | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (cachedUser && !user) {
      setUser(cachedUser);
      setLoading(false);
    }
  }, [cachedUser, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser(authUid: string | null, options: { background: boolean }) {
      if (!options.background) {
        setLoading(!useDashboardStore.getState().user);
        setError(null);
      }

      try {
        const phoneId = getStoredPhoneId();
        const storeUser = useDashboardStore.getState().user;

        if (authUid) {
          const byUid = await fetchByUid(authUid);
          if (cancelled) return;
          if (byUid) {
            setUser(byUid);
            useDashboardStore.getState().setUser(byUid);
            return;
          }
        }

        if (phoneId) {
          const byPhone = await fetchByPhoneId(phoneId);
          if (cancelled) return;
          if (byPhone) {
            setUser(byPhone);
            useDashboardStore.getState().setUser(byPhone);
            return;
          }
        }

        if (storeUser && phoneId) {
          setUser(storeUser);
          return;
        }

        if (!cancelled) setError('User not found');
      } catch {
        if (!cancelled && !useDashboardStore.getState().user) {
          setError('Failed to load user data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const hasCache =
        !!useDashboardStore.getState().user || !!userRef.current;
      void loadUser(firebaseUser?.uid ?? null, { background: hasCache });
    });

    // Don't wait forever for auth — resolve loading via phone/session cache too.
    void loadUser(auth.currentUser?.uid ?? null, {
      background: !!useDashboardStore.getState().user,
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
}

/** @deprecated Use useDashboardUser for authenticated dashboard */
export function useUserData(phoneOrId: string) {
  const [user, setUser] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phoneOrId.trim()) {
      setLoading(false);
      setError('No active session found');
      return;
    }

    let cancelled = false;

    async function fetchUser() {
      try {
        const phoneId = /^\d+$/.test(phoneOrId)
          ? phoneOrId
          : sanitizePhone(phoneOrId);
        const snap = await getDoc(doc(db, 'users', phoneId));
        if (cancelled) return;

        if (snap.exists()) {
          setUser(snap.data() as UserDocument);
        } else {
          setError('User not found');
        }
      } catch {
        if (!cancelled) setError('Failed to load user data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, [phoneOrId]);

  return { user, loading, error };
}
