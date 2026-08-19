import { useEffect, useMemo, useState } from 'react';
import type { UserJobListItem } from '../services/jobService';
import {
  ensureInstantBusinesses,
  refreshDashboardBusinesses,
} from '../lib/dashboardBusinesses';
import { filterRealBusinessIds } from '../lib/optimisticSignup';
import { useDashboardStore } from '../stores/dashboardStore';
import type { UserDocument } from '../types/user';

/**
 * IDs for dashboard / messages / add-job prefetch.
 * Home job-card slots no longer use this list — they listen to jobs/{id}.acceptedBy.
 */
function resolveMatchedBusinessIds(
  jobs: UserJobListItem[],
  user: UserDocument | null,
): string[] {
  const latestJobIds = jobs[0]?.matchedBusinessIds;
  if (latestJobIds && latestJobIds.length > 0) {
    return filterRealBusinessIds(latestJobIds);
  }

  if (user?.matchedBusinessIds && user.matchedBusinessIds.length > 0) {
    return filterRealBusinessIds(user.matchedBusinessIds);
  }

  return [];
}

export function useMatchedBusinesses(
  jobs: UserJobListItem[],
  user: UserDocument | null,
  refreshKey = 0,
) {
  const businesses = useDashboardStore((s) => s.businesses);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedBusinessIds = useMemo(
    () => resolveMatchedBusinessIds(jobs, user),
    [jobs, user],
  );

  const idsKey = matchedBusinessIds.join(',');

  useEffect(() => {
    ensureInstantBusinesses();
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setRefreshing(businesses.length === 0);
    setError(null);

    void refreshDashboardBusinesses(user, jobs).then((results) => {
      if (cancelled) return;
      if (results.length === 0) {
        setError('Unable to load business profiles right now.');
      }
      setRefreshing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, idsKey, refreshKey]);

  return {
    businesses,
    loading: refreshing && businesses.length === 0,
    error,
    matchedBusinessIds,
  };
}
