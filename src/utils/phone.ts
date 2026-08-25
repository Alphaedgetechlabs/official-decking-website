const AU_COUNTRY_CODE = '61';
const PK_COUNTRY_CODE = '92';

/** Strip spaces, dashes, and brackets. Preserves a leading +. */
export function cleanPhoneInput(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/[\s\-()]/g, '')}`;
  }
  return trimmed.replace(/[\s\-()]/g, '');
}

export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Converts user input to E.164 for Firebase `signInWithPhoneNumber`.
 *
 * Supports:
 * - International: +92…, +61…, +1… (kept as-is after cleaning)
 * - Pakistani: 03…, 0 + mobile, 3… (no leading 0), 92…
 * - Australian: 04…, 0 + mobile, 4… (no leading 0), 61…
 */
export function formatPhoneForAuth(phone: string): string {
  const cleaned = cleanPhoneInput(phone);

  if (!cleaned) {
    throw new Error('Phone number is required');
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D/g, '');
    if (!digits) {
      throw new Error('Invalid phone number');
    }
    return `+${digits}`;
  }

  const digits = getPhoneDigits(cleaned);

  if (!digits) {
    throw new Error('Phone number is required');
  }

  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  if (digits.startsWith('04')) {
    return `+${AU_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.startsWith('03')) {
    return `+${PK_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.startsWith(AU_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  if (digits.startsWith(PK_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    const national = digits.slice(1);
    if (national.startsWith('3')) {
      return `+${PK_COUNTRY_CODE}${national}`;
    }
    if (national.startsWith('4')) {
      return `+${AU_COUNTRY_CODE}${national}`;
    }
    return `+${AU_COUNTRY_CODE}${national}`;
  }

  // PK mobile without leading 0 (e.g. 3174433711 or 317443371)
  if (digits.startsWith('3')) {
    return `+${PK_COUNTRY_CODE}${digits}`;
  }

  // AU mobile without leading 0 (e.g. 412234562)
  if (digits.startsWith('4')) {
    return `+${AU_COUNTRY_CODE}${digits}`;
  }

  return `+${digits}`;
}

/** Alias for call sites that name the conversion explicitly. */
export const toE164ForAuth = formatPhoneForAuth;

/** Digits-only form (no +) for Firestore document IDs and lookups. */
export function sanitizePhone(phone: string): string {
  return formatPhoneForAuth(phone).slice(1);
}

export function toE164(phoneId: string): string {
  if (phoneId.startsWith('+')) {
    return phoneId;
  }
  return `+${phoneId}`;
}

/**
 * Flexible validation — accepts PK (+92 / 0 / 3…) and AU (+61 / 0 / 4…)
 * with 10 or 11 local digits, plus any valid international + number.
 */
export function isValidPhoneInput(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) {
    return false;
  }

  const digits = getPhoneDigits(trimmed);

  // Allow 7–13 raw digits (covers 10/11-digit local + country codes)
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }

  try {
    const e164 = formatPhoneForAuth(trimmed);
    const e164Digits = e164.slice(1);
    return /^[1-9]\d{7,14}$/.test(e164Digits);
  } catch {
    return false;
  }
}

export function getPhoneInputError(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return 'Please enter your phone number';
  }
  if (isValidPhoneInput(trimmed)) {
    return '';
  }
  return 'write a valid 10 digits number';
}

/** UI display: +923174433711 */
export function formatPhoneDisplay(phone: string): string {
  try {
    return formatPhoneForAuth(phone);
  } catch {
    return phone;
  }
}

/** All common display formats for Firestore phone-field lookup */
export function getPhoneLookupVariants(phone: string): string[] {
  const trimmed = phone.trim();
  let normalized: string;
  try {
    normalized = sanitizePhone(trimmed);
  } catch {
    return [trimmed];
  }

  const variants = new Set<string>([trimmed, normalized, `+${normalized}`]);

  if (normalized.startsWith(PK_COUNTRY_CODE)) {
    const local = normalized.slice(2);
    variants.add(local);
    variants.add(`0${local}`);
    variants.add(`03${local.slice(1)}`);
    variants.add(`+${PK_COUNTRY_CODE}${local}`);
    variants.add(`+${PK_COUNTRY_CODE} ${local}`);
    variants.add(`${PK_COUNTRY_CODE}${local}`);
    variants.add(`00${PK_COUNTRY_CODE}${local}`);
  }

  if (normalized.startsWith(AU_COUNTRY_CODE)) {
    const local = normalized.slice(2);
    variants.add(local);
    variants.add(`0${local}`);
    variants.add(`04${local.slice(1)}`);
    variants.add(`+${normalized}`);
  }

  return [...variants];
}
