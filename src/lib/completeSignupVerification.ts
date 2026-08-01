import type { ConfirmationResult } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import {
  cachePrefetchedBusinesses,
  buildOptimisticUserFromFormData,
  filterRealBusinesses,
} from '@/lib/optimisticSignup';
import { prefetchDashboardForUser } from '@/lib/dashboardBusinesses';
import { waitForCondition } from '@/lib/waitForCondition';
import { findUserByPhone, verifySignupOtp } from '@/services/authService';
import {
  fetchRandomBusinesses,
  resolveMatchedBusinessesForJob,
  type BusinessProfile,
} from '@/services/businessService';
import {
  buildSignupJobFromUser,
  type PostedNotificationsPayload,
  type StaggerAcceptPlan,
  saveAdditionalJob,
} from '@/services/jobService';
import { saveUserQuoteRequest } from '@/services/userService';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { UserDocument } from '@/types/user';
import type { StoredLocation } from '@/types/location';
import type { WizardFormData } from '@/types/wizard';
import { saveSession } from '@/utils/session';
import { sanitizePhone } from '@/utils/phone';

/** Wait until Auth currentUser + ID token are ready for Firestore rules. */
async function waitForVerifiedAuthUser(uid: string): Promise<void> {
  await auth.authStateReady();
  await waitForCondition(() => auth.currentUser?.uid === uid);
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error('Authentication failed. Please try again.');
  }
  // Ensure the ID token is minted before Firestore reads that require auth.
  await user.getIdToken();
}

/**
 * Same match order as createJob: prefetched → geo radius → random.
 * Must finish before the matching UI advances.
 */
async function resolveBusinessesOrFetch(
  primary: BusinessProfile[],
  fallback: BusinessProfile[],
  locationData?: StoredLocation | null,
): Promise<BusinessProfile[]> {
  let resolved = filterRealBusinesses(primary.length > 0 ? primary : fallback);
  if (resolved.length === 0 && locationData) {
    resolved = filterRealBusinesses(
      await resolveMatchedBusinessesForJob(locationData),
    );
  }
  if (resolved.length === 0) {
    resolved = filterRealBusinesses(await fetchRandomBusinesses(3));
  }
  if (resolved.length === 0) {
    throw new Error('Unable to load matched businesses.');
  }
  return resolved;
}

export async function completeSignupVerification(params: {
  confirmation: ConfirmationResult;
  otp: string;
  formData: WizardFormData;
  matchedBusinesses: BusinessProfile[];
}): Promise<{
  user: UserDocument;
  businesses: BusinessProfile[];
  staggerAcceptPlan: StaggerAcceptPlan | null;
  postedNotificationsPayload: PostedNotificationsPayload | null;
}> {
  const uid = await verifySignupOtp(params.confirmation, params.otp);

  // OTP confirm can resolve before Auth state/token is usable by Firestore.
  await waitForVerifiedAuthUser(uid);

  const existing = await findUserByPhone(params.formData.phone);

  // Block only until we have a list the matching screen can render.
  // Prefer already-prefetched matches so geo/random fetches stay in the background.
  const prefetched = filterRealBusinesses(params.matchedBusinesses);
  const resolvedBusinesses =
    prefetched.length > 0
      ? prefetched
      : await resolveBusinessesOrFetch(
          params.matchedBusinesses,
          [],
          params.formData.locationData,
        );

  if (prefetched.length > 0) {
    void resolveBusinessesOrFetch(
      params.matchedBusinesses,
      [],
      params.formData.locationData,
    )
      .then((businesses) => cachePrefetchedBusinesses(businesses))
      .catch((err) => {
        console.warn('Background business refresh skipped:', err);
      });
  }

  if (existing) {
    return completeExistingUserJobPost({
      uid,
      formData: params.formData,
      docId: existing.docId,
      existingUser: existing.data,
      matchedBusinesses: resolvedBusinesses,
    });
  }

  return completeNewUserSignup({
    uid,
    formData: params.formData,
    matchedBusinesses: resolvedBusinesses,
  });
}

async function completeExistingUserJobPost(params: {
  uid: string;
  formData: WizardFormData;
  docId: string;
  existingUser: UserDocument;
  matchedBusinesses: BusinessProfile[];
}): Promise<{
  user: UserDocument;
  businesses: BusinessProfile[];
  staggerAcceptPlan: StaggerAcceptPlan;
  postedNotificationsPayload: PostedNotificationsPayload;
}> {
  const phoneNormalized = sanitizePhone(params.formData.phone);
  const user = params.existingUser;

  const sessionUser: UserDocument = {
    ...user,
    uid: params.uid,
    isVerified: true,
    phone: phoneNormalized,
    phoneNormalized,
  };

  saveSession(phoneNormalized);

  const store = useDashboardStore.getState();
  store.setUser(sessionUser);
  cachePrefetchedBusinesses(params.matchedBusinesses);

  void prefetchDashboardForUser(sessionUser).catch((err) => {
    console.error('Failed to prefetch dashboard for user:', err);
  });

  const profileEmail =
    typeof user.email === 'string' ? user.email.trim() : '';
  const formEmail =
    typeof params.formData.email === 'string'
      ? params.formData.email.trim()
      : '';

  const jobFormData: WizardFormData = {
    ...params.formData,
    fullName: typeof user.fullName === 'string' ? user.fullName : '',
    // Prefer stored profile email; fall back to what the user entered in the wizard.
    email: profileEmail || formEmail,
  };

  // Same as "+": createJob (via saveAdditionalJob) first — throws on failure.
  const { postedNotificationsPayload, staggerAcceptPlan } = await saveAdditionalJob(jobFormData, params.uid, params.docId, {
    prefetchedBusinesses: params.matchedBusinesses,
  });

  // Auth/session fields only — must not block or undo the job write.
  try {
    await updateDoc(doc(db, 'users', params.docId), {
      uid: params.uid,
      isVerified: true,
      phone: phoneNormalized,
      phoneNormalized,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to update user auth fields after job post:', err);
  }

  return {
    user: sessionUser,
    businesses: params.matchedBusinesses,
    staggerAcceptPlan,
    postedNotificationsPayload,
  };
}

async function completeNewUserSignup(params: {
  uid: string;
  formData: WizardFormData;
  matchedBusinesses: BusinessProfile[];
}): Promise<{
  user: UserDocument;
  businesses: BusinessProfile[];
  staggerAcceptPlan: StaggerAcceptPlan;
  postedNotificationsPayload: PostedNotificationsPayload;
}> {
  const phoneId = sanitizePhone(params.formData.phone);

  const user: UserDocument = {
    ...buildOptimisticUserFromFormData(
      params.formData,
      phoneId,
      params.matchedBusinesses.map((business) => business.id),
    ),
    uid: params.uid,
    isVerified: true,
    photoUrls: [],
  };

  saveSession(phoneId);

  const store = useDashboardStore.getState();
  store.setUser(user);
  cachePrefetchedBusinesses(params.matchedBusinesses);

  const signupJob = buildSignupJobFromUser(user);
  if (signupJob) {
    store.setJobs([signupJob]);
  }

  void prefetchDashboardForUser(user).catch((err) => {
    console.error('Failed to prefetch dashboard for user:', err);
  });

  // Await createJob (throws on failure → OTP error UI). Post-job work is
  // best-effort inside saveUserQuoteRequest.
  const { postedNotificationsPayload, staggerAcceptPlan } = await saveUserQuoteRequest(params.formData, params.uid, {
    prefetchedBusinesses: params.matchedBusinesses,
  });

  return {
    user,
    businesses: params.matchedBusinesses,
    staggerAcceptPlan,
    postedNotificationsPayload,
  };
}
