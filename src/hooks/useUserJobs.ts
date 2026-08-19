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
    // Only rebuild when the fields that define a synthetic job change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow deps
    [user?.jobDescription, user?.location, user?.matchedBusinessIds, user?.phone],
  );

  useEffect(() => {
    if (!uid) {
      setFirestoreJobs([]);
      setLoading(!useDashboardStore.getState().jobs.length);
      setError(null);
      return;
    }

    setLoading(useDashboardStore.getState().jobs.length === 0);
    setError(null);

    const unsubscribe = subscribeUserJobs(
      uid,
      userId,
      (jobs) => {
        setFirestoreJobs(jobs);
        useDashboardStore.getState().setJobs(mergeUserJobs(null, jobs));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
    // Do NOT depend on cachedJobs.length / signupJob — that re-subscribed on
    // every store update and could leave overlapping listeners / inflated lists.
  }, [uid, userId]);

  const jobs = useMemo(
    () =>
      mergeUserJobs(
        signupJob,
        firestoreJobs.length > 0 ? firestoreJobs : cachedJobs,
      ),
    [signupJob, firestoreJobs, cachedJobs],
  );

  return { jobs, loading: loading && !jobs.length, error };
}
