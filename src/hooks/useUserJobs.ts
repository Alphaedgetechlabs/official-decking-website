import { useEffect, useMemo, useState } from 'react';
import {
  buildSignupJobFromUser,
  mergeUserJobs,
  subscribeUserJobs,
  type UserJobListItem,
} from '../services/jobService';
import { useDashboardStore } from '../stores/dashboardStore';
import type { UserDocument } from '../types/user';

export function useUserJobs(
  uid: string | null,
  user: UserDocument | null,
  userId: string,
) {
  const cachedJobs = useDashboardStore((s) => s.jobs);
  const [firestoreJobs, setFirestoreJobs] = useState<UserJobListItem[]>([]);
  const [loading, setLoading] = useState(!cachedJobs.length && !!uid);
  const [error, setError] = useState<string | null>(null);

  const signupJob = useMemo(
    () => (user ? buildSignupJobFromUser(user) : null),
    [user],
  );

  useEffect(() => {
    if (!uid) {
      setFirestoreJobs([]);
      setLoading(!cachedJobs.length);
      setError(null);
      return;
    }

    const hasCache = cachedJobs.length > 0;
    if (!hasCache) {
      setLoading(true);
    }
    setError(null);

    const unsubscribe = subscribeUserJobs(
      uid,
      userId,
      (jobs) => {
        setFirestoreJobs(jobs);
        useDashboardStore.getState().setJobs(mergeUserJobs(signupJob, jobs));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid, userId, cachedJobs.length, signupJob]);

  const jobs = useMemo(
    () => mergeUserJobs(signupJob, firestoreJobs.length ? firestoreJobs : cachedJobs),
    [signupJob, firestoreJobs, cachedJobs],
  );

  return { jobs, loading: loading && !jobs.length, error };
}
