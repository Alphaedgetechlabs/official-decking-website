import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export function useAuthUid() {
  const [authUid, setAuthUid] = useState<string | null>(
    auth.currentUser?.uid ?? null,
  );
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setAuthReady(true);
    });
    // If auth persistence never emits, don't leave the app on an infinite loader.
    const timeoutId = window.setTimeout(() => setAuthReady(true), 4000);
    return () => {
      unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return { authUid, authReady };
}
