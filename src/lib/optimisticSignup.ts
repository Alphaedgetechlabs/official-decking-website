import { JOB_CONTRACTORS } from '@/data/jobContractors';
import { buildSignupJobFromUser } from '@/services/jobService';
import type { BusinessProfile } from '@/services/businessService';
import type { UserDocument } from '@/types/user';
import type { WizardFormData } from '@/types/wizard';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { sanitizePhone } from '@/utils/phone';
import { saveSession } from '@/utils/session';

const PLACEHOLDER_BUSINESS_IDS = new Set(
  JOB_CONTRACTORS.map((contractor) => contractor.id),
);

export const OPTIMISTIC_BUSINESSES_KEY = 'optimistic-display';

export function isPlaceholderBusinessId(id: string): boolean {
  return PLACEHOLDER_BUSINESS_IDS.has(id);
}

export function filterRealBusinesses(
  businesses: BusinessProfile[],
): BusinessProfile[] {
  return businesses.filter((business) => !isPlaceholderBusinessId(business.id));
}

export function filterRealBusinessIds(ids: string[]): string[] {
  return ids.filter((id) => !isPlaceholderBusinessId(id));
}

/** Fallback contractors for the matching animation only — not Firestore IDs. */
export function buildPlaceholderBusinesses(): BusinessProfile[] {
  return JOB_CONTRACTORS.map((contractor) => ({
    id: contractor.id,
    uid: contractor.id,
    email: '',
    businessName: contractor.name,
    phone: '',
  }));
}

export function buildOptimisticUserFromFormData(
  formData: WizardFormData,
  phoneId: string,
  matchedBusinessIds: string[],
): UserDocument {
  return {
    type: 'user',
    fullName: formData.fullName.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: phoneId,
    phoneNormalized: phoneId,
    location: formData.locationData?.displayLabel ?? formData.location,
    locationData: formData.locationData ?? undefined,
    timeline: formData.timeline,
    jobDescription: formData.jobDescription.trim(),
    photoUrls: [],
    isVerified: true,
    matchedBusinessIds: filterRealBusinessIds(matchedBusinessIds),
  };
}

export function resolveSignupBusinesses(
  matchedBusinesses: BusinessProfile[],
): BusinessProfile[] {
  if (matchedBusinesses.length > 0) return matchedBusinesses;

  const cached = useDashboardStore.getState().businesses;
  if (cached.length > 0) return cached;

  return buildPlaceholderBusinesses();
}

/** Sync local/dashboard state before advancing to matching or /app. */
export function hydrateOptimisticSignupState(
  formData: WizardFormData,
  matchedBusinesses: BusinessProfile[],
  setMatchedBusinesses?: (businesses: BusinessProfile[]) => void,
): { user: UserDocument; businesses: BusinessProfile[] } {
  const phoneId = sanitizePhone(formData.phone);
  const businesses = resolveSignupBusinesses(matchedBusinesses);
  const realBusinesses = filterRealBusinesses(businesses);
  const realIds = realBusinesses.map((business) => business.id);

  if (matchedBusinesses.length === 0 && businesses.length > 0) {
    setMatchedBusinesses?.(businesses);
  }

  const user = buildOptimisticUserFromFormData(formData, phoneId, realIds);

  saveSession(phoneId);
  useAuthFlowStore.getState().setOptimisticAuth(true);

  const store = useDashboardStore.getState();
  store.setUser(user);

  if (businesses.length > 0) {
    store.setBusinesses(
      businesses,
      realIds.length > 0 ? realIds.join(',') : OPTIMISTIC_BUSINESSES_KEY,
    );
  }

  const signupJob = buildSignupJobFromUser(user);
  if (signupJob) {
    store.setJobs([signupJob]);
  }

  return { user, businesses };
}

export function cachePrefetchedBusinesses(businesses: BusinessProfile[]): void {
  if (businesses.length === 0) return;

  const realIds = filterRealBusinessIds(businesses.map((business) => business.id));
  useDashboardStore.getState().setBusinesses(
    businesses,
    realIds.length > 0 ? realIds.join(',') : OPTIMISTIC_BUSINESSES_KEY,
  );
}

export async function prefetchBusinessesForUser(
  user: UserDocument,
): Promise<void> {
  const { prefetchDashboardForUser } = await import('@/lib/dashboardBusinesses');
  await prefetchDashboardForUser(user);
}
