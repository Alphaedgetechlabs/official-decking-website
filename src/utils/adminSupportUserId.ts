import { auth } from '../firebase';
import { sanitizePhone } from './phone';
import { getStoredPhoneId } from './session';

/** Phone doc id for admin support RTDB paths (matches admin dashboard). */
export function resolveAdminSupportUserId(
  phone?: string | null,
  fallbackPhoneId?: string | null,
): string | null {
  const raw = phone?.trim() || fallbackPhoneId?.trim() || getStoredPhoneId();
  if (!raw) return auth.currentUser?.uid ?? null;

  if (/^\d+$/.test(raw)) return raw;

  try {
    return sanitizePhone(raw);
  } catch {
    return auth.currentUser?.uid ?? null;
  }
}
