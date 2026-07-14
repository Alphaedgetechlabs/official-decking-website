import type { ConfirmationResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { prefetchDashboardForUser } from '@/lib/dashboardBusinesses';
import { filterRealBusinesses } from '@/lib/optimisticSignup';
import { verifyLoginOtp } from '@/services/authService';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { UserDocument } from '@/types/user';
import { saveSession } from '@/utils/session';

export async function completeLoginVerification(params: {
  confirmation: ConfirmationResult;
  otp: string;
  docId: string;
  phoneNormalized: string;
}): Promise<UserDocument> {
  await verifyLoginOtp(
    params.confirmation,
    params.otp,
    params.docId,
    params.phoneNormalized,
  );

  const userSnap = await getDoc(doc(db, 'users', params.docId));
  if (!userSnap.exists()) {
    throw new Error('User account not found after verification.');
  }

  const user = userSnap.data() as UserDocument;
  useDashboardStore.getState().setUser(user);
  saveSession(params.phoneNormalized);
  await prefetchDashboardForUser(user);

  const businesses = filterRealBusinesses(
    useDashboardStore.getState().businesses,
  );
  if (businesses.length === 0) {
    throw new Error('Unable to load matched businesses.');
  }

  return user;
}
