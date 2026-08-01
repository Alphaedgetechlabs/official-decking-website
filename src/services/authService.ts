import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  type ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { setOfflinePresence } from './rtdb/presenceService';
import type { UserDocument } from '../types/user';
import {
  formatPhoneForAuth,
  getPhoneLookupVariants,
  sanitizePhone,
} from '../utils/phone';

const USERS_COLLECTION = 'users';
const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

let recaptchaInitPromise: Promise<RecaptchaVerifier> | null = null;

export interface FoundUser {
  docId: string;
  data: UserDocument;
}

export function getAuthErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    switch (code) {
      case 'auth/invalid-phone-number':
        return 'Invalid phone number. Please check the number and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/captcha-check-failed':
        return 'Security verification failed. Please try again.';
      case 'auth/quota-exceeded':
        return 'SMS limit reached. Please try again later.';
      case 'auth/operation-not-allowed':
        return 'Phone login is not enabled in Firebase. Contact support.';
      case 'auth/missing-phone-number':
        return 'Please enter a valid phone number.';
      case 'auth/invalid-app-credential':
        return 'Firebase app credential error. Check API key, authorized domains, and reCAPTCHA in Firebase Console.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return `${fallback} (${code})`;
    }
  }
  return fallback;
}

export async function findUserByPhone(
  enteredPhone: string,
): Promise<FoundUser | null> {
  const trimmed = enteredPhone.trim();

  let normalized: string;
  try {
    normalized = sanitizePhone(trimmed);
  } catch {
    return null;
  }

  const byId = await getDoc(doc(db, USERS_COLLECTION, normalized));
  if (byId.exists()) {
    return { docId: normalized, data: byId.data() as UserDocument };
  }

  const normQuery = query(
    collection(db, USERS_COLLECTION),
    where('phoneNormalized', '==', normalized),
  );
  const normSnap = await getDocs(normQuery);
  if (!normSnap.empty) {
    const docSnap = normSnap.docs[0];
    return { docId: docSnap.id, data: docSnap.data() as UserDocument };
  }

  const variants = getPhoneLookupVariants(trimmed);
  for (const variant of variants) {
    const phoneQuery = query(
      collection(db, USERS_COLLECTION),
      where('phone', '==', variant),
    );
    const snapshot = await getDocs(phoneQuery);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { docId: docSnap.id, data: docSnap.data() as UserDocument };
    }
  }

  return null;
}

export function createRecaptchaVerifier(
  containerId: string = RECAPTCHA_CONTAINER_ID,
): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      console.info('reCAPTCHA solved');
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired — please try again.');
      clearRecaptchaVerifier();
    },
  });
}

function replaceRecaptchaContainer(): void {
  const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!container?.parentNode) {
    return;
  }

  const fresh = document.createElement('div');
  fresh.id = RECAPTCHA_CONTAINER_ID;
  fresh.className = container.className;
  fresh.setAttribute('aria-hidden', 'true');
  container.parentNode.replaceChild(fresh, container);
}

export function clearRecaptchaVerifier(): void {
  recaptchaInitPromise = null;

  try {
    window.recaptchaVerifier?.clear();
  } catch (err) {
    console.error('reCAPTCHA clear error:', err);
  }

  window.recaptchaVerifier = undefined;
  window.recaptchaWidgetId = undefined;
  replaceRecaptchaContainer();
}

export async function ensureRecaptchaReady(): Promise<RecaptchaVerifier> {
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  recaptchaInitPromise ??= (async () => {
    const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
    if (!container) {
      throw new Error('reCAPTCHA container not found in DOM');
    }

    const verifier = createRecaptchaVerifier(RECAPTCHA_CONTAINER_ID);
    window.recaptchaVerifier = verifier;
    await verifier.render();
    return verifier;
  })();

  try {
    return await recaptchaInitPromise;
  } catch (err) {
    console.error('reCAPTCHA init error:', err);
    clearRecaptchaVerifier();
    throw err;
  } finally {
    recaptchaInitPromise = null;
  }
}

export async function resetRecaptchaVerifier(): Promise<void> {
  clearRecaptchaVerifier();
}

export async function sendLoginOtp(
  phone: string,
  recaptcha: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  const e164Phone = formatPhoneForAuth(phone);

  try {
    console.info('Sending OTP to:', e164Phone);
    return await signInWithPhoneNumber(auth, e164Phone, recaptcha);
  } catch (err) {
    console.error('signInWithPhoneNumber failed:', { phone: e164Phone, err });
    throw err;
  }
}

export async function verifySignupOtp(
  confirmation: ConfirmationResult,
  otp: string,
): Promise<string> {
  const result = await confirmation.confirm(otp);
  return result.user.uid;
}

export async function verifyLoginOtp(
  confirmation: ConfirmationResult,
  otp: string,
  docId: string,
  phoneNormalized: string,
): Promise<string> {
  const result = await confirmation.confirm(otp);
  const uid = result.user.uid;

  await updateDoc(doc(db, USERS_COLLECTION, docId), {
    uid,
    isVerified: true,
    phone: phoneNormalized,
    phoneNormalized,
    updatedAt: serverTimestamp(),
  });

  return uid;
}

export async function logoutUser(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    void setOfflinePresence(uid).catch((err) => {
      console.error('Failed to set offline presence on logout:', err);
    });
  }
  await signOut(auth);
}
