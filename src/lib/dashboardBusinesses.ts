import { auth } from '@/firebase';
import {
  fetchBusinessesByIds,
  fetchRandomBusinesses,
  type BusinessProfile,
} from '@/services/businessService';
import type { UserJobListItem } from '@/services/jobService';
import { buildSignupJobFromUser } from '@/services/jobService';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { UserDocument } from '@/types/user';
import {
  buildPlaceholderBusinesses,
  filterRealBusinessIds,
  OPTIMISTIC_BUSINESSES_KEY,
} from '@/lib/optimisticSignup';
import { waitForCondition } from '@/lib/waitForCondition';

function resolveBusinessIds(
  user: UserDocument | null,
  jobs: UserJobListItem[],
): string[] {
  const jobIds = jobs[0]?.matchedBusinessIds ?? [];
  if (jobIds.length > 0) {
    return filterRealBusinessIds(jobIds);
  }
  return filterRealBusinessIds(user?.matchedBusinessIds ?? []);
}

async function waitForAuthIfNeeded(timeoutMs = 20_000): Promise<void> {
  if (auth.currentUser) return;

  const { optimisticAuth } = useAuthFlowStore.getState();
  if (!optimisticAuth && !hasActiveSession()) return;

  try {
    await waitForCondition(() => auth.currentUser, timeoutMs);
  } catch {
    // Continue with best-effort fetch; placeholders remain visible if this fails.
  }
}

function hasActiveSession(): boolean {
  try {
    return localStorage.getItem('qmf_session_phone') !== null;
  } catch {
    return false;
  }
}

/** Synchronous — guarantees the store always has something to render. */
export function ensureInstantBusinesses(): BusinessProfile[] {
  const store = useDashboardStore.getState();
  if (store.businesses.length > 0) {
    return store.businesses;
  }

  const placeholders = buildPlaceholderBusinesses();
  store.setBusinesses(placeholders, OPTIMISTIC_BUSINESSES_KEY);
  return placeholders;
}

/** Fetch real businesses from Firestore and update the store. */
export async function refreshDashboardBusinesses(
  user: UserDocument | null,
  jobs: UserJobListItem[] = [],
): Promise<BusinessProfile[]> {
  const ids = resolveBusinessIds(user, jobs);
  const idsKey = ids.join(',');

  // Always re-fetch so isAutoAcceptEnabled toggles show up without a hard reload.
  await waitForAuthIfNeeded();

  try {
    let results: BusinessProfile[] = [];

    if (ids.length > 0) {
      results = await fetchBusinessesByIds(ids);
    }

    if (results.length === 0) {
      results = await fetchRandomBusinesses(3);
    }

    if (results.length > 0) {
      const resolvedKey =
        ids.length > 0 &&
        results.every((business) => ids.includes(business.id))
          ? idsKey
          : results.map((business) => business.id).join(',');
      useDashboardStore.getState().setBusinesses(results, resolvedKey);
      return results;
    }
  } catch (err) {
    console.error('Failed to refresh dashboard businesses:', err);
  }

  return ensureInstantBusinesses();
}

/** Prefetch user + businesses during login/signup before /app. */
export async function prefetchDashboardForUser(
  user: UserDocument,
): Promise<void> {
  const store = useDashboardStore.getState();
  store.setUser(user);

  const signupJob = buildSignupJobFromUser(user);
  if (signupJob) {
    store.setJobs([signupJob]);
  }

  ensureInstantBusinesses();
  await refreshDashboardBusinesses(user, signupJob ? [signupJob] : []);
}

export function cacheBusinesses(businesses: BusinessProfile[]): void {
  if (businesses.length === 0) return;

  const realIds = filterRealBusinessIds(businesses.map((business) => business.id));
  useDashboardStore.getState().setBusinesses(
    businesses,
    realIds.length > 0 ? realIds.join(',') : OPTIMISTIC_BUSINESSES_KEY,
  );
}
