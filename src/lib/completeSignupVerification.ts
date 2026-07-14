import type { ConfirmationResult } from 'firebase/auth';
import { cachePrefetchedBusinesses, buildOptimisticUserFromFormData, filterRealBusinesses } from '@/lib/optimisticSignup';
import { prefetchDashboardForUser } from '@/lib/dashboardBusinesses';
import { verifySignupOtp } from '@/services/authService';
import type { BusinessProfile } from '@/services/businessService';
import { buildSignupJobFromUser } from '@/services/jobService';
import { saveUserQuoteRequest } from '@/services/userService';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { UserDocument } from '@/types/user';
import type { WizardFormData } from '@/types/wizard';
import { saveSession } from '@/utils/session';

export async function completeSignupVerification(params: {
  confirmation: ConfirmationResult;
  otp: string;
  formData: WizardFormData;
  matchedBusinesses: BusinessProfile[];
}): Promise<{ user: UserDocument; businesses: BusinessProfile[] }> {
  const uid = await verifySignupOtp(params.confirmation, params.otp);

  const preselected = filterRealBusinesses(
    params.matchedBusinesses.length > 0
      ? params.matchedBusinesses
      : useDashboardStore.getState().businesses,
  );

  const { phoneId, matchedBusinesses, photoUrls } = await saveUserQuoteRequest(
    params.formData,
    uid,
    preselected.length > 0 ? preselected : undefined,
  );

  const user: UserDocument = {
    ...buildOptimisticUserFromFormData(
      params.formData,
      phoneId,
      matchedBusinesses.map((business) => business.id),
    ),
    uid,
    isVerified: true,
    photoUrls,
  };

  saveSession(phoneId);

  const store = useDashboardStore.getState();
  store.setUser(user);
  cachePrefetchedBusinesses(matchedBusinesses);

  const signupJob = buildSignupJobFromUser(user);
  if (signupJob) {
    store.setJobs([signupJob]);
  }

  await prefetchDashboardForUser(user);

  const resolvedBusinesses = filterRealBusinesses(
    useDashboardStore.getState().businesses.length > 0
      ? useDashboardStore.getState().businesses
      : matchedBusinesses,
  );

  if (resolvedBusinesses.length === 0) {
    throw new Error('Unable to load matched businesses.');
  }

  return { user, businesses: resolvedBusinesses };
}
