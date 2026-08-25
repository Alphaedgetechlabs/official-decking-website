import { useEffect, useState } from 'react';
import {
  collectionGroup,
  onSnapshot,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  fetchBusinessesByIds,
  type BusinessProfile,
} from '../services/businessService';

const userAcceptedCache = new Map<string, BusinessProfile[]>();

function businessIdFromAcceptedJobDoc(
  snapshot: QueryDocumentSnapshot,
): string | null {
  const fromField = snapshot.data()?.businessId;
  if (typeof fromField === 'string' && fromField.trim()) {
    return fromField.trim();
  }

  // Path: businesses/{businessId}/accepted_jobs/{jobId}
  const businessRef = snapshot.ref.parent.parent;
  const id = businessRef?.id?.trim();
  return id || null;
}

/**
 * Live listener: businesses that accepted ≥1 job for this auth user.
 * Sole source for the user-side business chat list.
 */
export function useUserAcceptedBusinesses(authUid: string | null | undefined): {
  businesses: BusinessProfile[];
  loading: boolean;
} {
  const uid = authUid?.trim() || '';
  const [businesses, setBusinesses] = useState<BusinessProfile[]>(
    () => (uid ? userAcceptedCache.get(uid) ?? [] : []),
  );
  const [loading, setLoading] = useState(() => {
    if (!uid) return false;
    return !userAcceptedCache.has(uid);
  });
  const [readyUid, setReadyUid] = useState<string | null>(
    () => auth.currentUser?.uid ?? null,
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setReadyUid(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    const effectiveUid = uid || readyUid || '';
    if (!effectiveUid) {
      setBusinesses([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let fetchGeneration = 0;
    if (!userAcceptedCache.has(effectiveUid)) {
      setLoading(true);
    }

    const acceptedJobsQuery = query(
      collectionGroup(db, 'accepted_jobs'),
      where('uid', '==', effectiveUid),
    );

    const unsubscribe = onSnapshot(
      acceptedJobsQuery,
      (snapshot) => {
        const acceptedIds: string[] = [];
        const seen = new Set<string>();

        for (const docSnap of snapshot.docs) {
          const businessId = businessIdFromAcceptedJobDoc(docSnap);
          if (!businessId || seen.has(businessId)) continue;
          seen.add(businessId);
          acceptedIds.push(businessId);
        }

        const generation = ++fetchGeneration;

        if (acceptedIds.length === 0) {
          if (!cancelled) {
            userAcceptedCache.set(effectiveUid, []);
            setBusinesses([]);
            setLoading(false);
          }
          return;
        }

        void fetchBusinessesByIds(acceptedIds)
          .then((profiles) => {
            if (cancelled || generation !== fetchGeneration) return;
            const byId = new Map(profiles.map((p) => [p.id, p]));
            const next = acceptedIds
              .map((id) => byId.get(id))
              .filter((b): b is BusinessProfile => b != null);
            userAcceptedCache.set(effectiveUid, next);
            setBusinesses(next);
            setLoading(false);
          })
          .catch((err) => {
            console.error(
              `[useUserAcceptedBusinesses] fetchBusinessesByIds:`,
              err,
            );
            if (!cancelled && generation === fetchGeneration) {
              setBusinesses([]);
              setLoading(false);
            }
          });
      },
      (err) => {
        console.error(
          `[useUserAcceptedBusinesses] accepted_jobs uid=${effectiveUid}:`,
          err,
        );
        if (!cancelled) {
          setBusinesses([]);
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, readyUid]);

  return { businesses, loading };
}
