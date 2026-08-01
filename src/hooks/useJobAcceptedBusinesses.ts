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
import { TARGET_MATCH_SLOTS } from '../utils/businessMatchStatus';

/** Survives Home tab unmount so remount can seed without a loading flash. */
const acceptedBusinessesCache = new Map<string, BusinessProfile[]>();

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
 * Live listener on collectionGroup('accepted_jobs') for this job —
 * sole signal for filled Home slots (auto + manual accept).
 */
export function useJobAcceptedBusinesses(jobId: string): {
  businesses: BusinessProfile[];
  skeletonCount: number;
  loading: boolean;
} {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>(
    () => acceptedBusinessesCache.get(jobId) ?? [],
  );
  const [loading, setLoading] = useState(
    () => !acceptedBusinessesCache.has(jobId),
  );
  const [authUid, setAuthUid] = useState<string | null>(
    () => auth.currentUser?.uid ?? null,
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    console.log('QMF-DEBUG jobId:', jobId);
    console.log('QMF-DEBUG authUid:', authUid);

    if (!jobId || jobId === 'signup-job' || !authUid) {
      setBusinesses([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let fetchGeneration = 0;
    if (!acceptedBusinessesCache.has(jobId)) {
      setLoading(true);
    }

    const acceptedJobsQuery = query(
      collectionGroup(db, 'accepted_jobs'),
      where('jobId', '==', jobId),
      where('uid', '==', authUid),
    );

    const unsubscribe = onSnapshot(
      acceptedJobsQuery,
      (snapshot) => {
        console.log('QMF-DEBUG snapshot.size:', snapshot.size);

        const acceptedIds: string[] = [];
        const seen = new Set<string>();

        for (const docSnap of snapshot.docs) {
          const businessId = businessIdFromAcceptedJobDoc(docSnap);
          if (!businessId || seen.has(businessId)) continue;
          seen.add(businessId);
          acceptedIds.push(businessId);
          if (acceptedIds.length >= TARGET_MATCH_SLOTS) break;
        }

        console.log('QMF-DEBUG extracted businessIds:', acceptedIds);
        console.log('[STAGGER] accepted_jobs snapshot — count:', acceptedIds.length, 'at', Date.now());

        const generation = ++fetchGeneration;

        if (acceptedIds.length === 0) {
          if (!cancelled) {
            acceptedBusinessesCache.set(jobId, []);
            setBusinesses([]);
            setLoading(false);
          }
          return;
        }

        void fetchBusinessesByIds(acceptedIds)
          .then((profiles) => {
            console.log('QMF-DEBUG profiles.length:', profiles.length);
            console.log('QMF-DEBUG profiles:', profiles);
            if (cancelled || generation !== fetchGeneration) return;
            const byId = new Map(profiles.map((p) => [p.id, p]));
            const next = acceptedIds
              .map((id) => byId.get(id))
              .filter((b): b is BusinessProfile => b != null);
            acceptedBusinessesCache.set(jobId, next);
            setBusinesses(next);
            setLoading(false);
          })
          .catch((err) => {
            console.log('QMF-DEBUG fetchBusinessesByIds error:', err);
            console.log('QMF-DEBUG profiles:', null);
          });
      },
      (err) => {
        console.error(
          `[useJobAcceptedBusinesses] accepted_jobs jobId=${jobId}:`,
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
  }, [jobId, authUid]);

  const skeletonCount = Math.max(0, TARGET_MATCH_SLOTS - businesses.length);

  return { businesses, skeletonCount, loading };
}
