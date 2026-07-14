import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export function useAuthUid() {
  const [authUid, setAuthUid] = useState<string | null>(
    auth.currentUser?.uid ?? null,
  );
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
      setAuthReady(true);
    });
  }, []);

  return { authUid, authReady };
}
