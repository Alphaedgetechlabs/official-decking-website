/**
 * Temporary auto-accept configuration while only a handful of businesses
 * are live on the platform. Replace the placeholder Firestore document IDs
 * (or set `VITE_AUTO_ACCEPT_BUSINESS_IDS`) with the real `businesses/{id}` IDs.
 */
const ENV_IDS = (import.meta.env.VITE_AUTO_ACCEPT_BUSINESS_IDS as string | undefined)
  ?.split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/** Firestore `businesses` document IDs used for temporary auto-accept. */
export const AUTO_ACCEPT_BUSINESS_IDS: string[] =
  ENV_IDS && ENV_IDS.length > 0
    ? ENV_IDS
    : [
        // TODO: replace with real business document IDs
        'BUSINESS_1_UID',
        'BUSINESS_2_UID',
        'BUSINESS_3_UID',
      ];

export const AUTO_ACCEPT_ENABLED = true;
export const STAGGERED_ACCEPT_ENABLED = true;
