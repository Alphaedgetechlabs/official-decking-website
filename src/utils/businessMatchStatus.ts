import { getConfiguredAutoAcceptBusinessIds } from '../services/autoAcceptJobService';
import type { BusinessProfile } from '../services/businessService';

export type BusinessMatchStatus = 'accepted' | 'auto-accepted' | 'pending';
export type JobType =
  | 'fencing'
  | 'retaining-wall'
  | 'decking'
  | 'landscaping';

/** Total tradie slots shown while waiting for remaining accepts. */
export const TARGET_MATCH_SLOTS = 3;

function hasAutoAcceptFlag(business: BusinessProfile): boolean {
  const raw = business as BusinessProfile & Record<string, unknown>;
  const flag = raw.isAutoAcceptEnabled ?? raw.autoAcceptEnabled;
  return flag === true || flag === 'true' || flag === 1;
}

export function resolveBusinessMatchStatus(
  business: BusinessProfile,
): BusinessMatchStatus {
  if (hasAutoAcceptFlag(business)) return 'auto-accepted';

  const autoAcceptIds = getConfiguredAutoAcceptBusinessIds();
  if (
    autoAcceptIds.includes(business.id) ||
    (business.uid != null && autoAcceptIds.includes(business.uid))
  ) {
    return 'auto-accepted';
  }

  return 'pending';
}

export function isAcceptedMatchStatus(status: BusinessMatchStatus): boolean {
  return status === 'accepted' || status === 'auto-accepted';
}

export function isAcceptedBusiness(business: BusinessProfile): boolean {
  return isAcceptedMatchStatus(resolveBusinessMatchStatus(business));
}

/** True when services_provided includes jobType or 'Both' (case-insensitive). */
export function businessProvidesJobType(
  business: BusinessProfile,
  jobType: JobType,
): boolean {
  const services = business.services_provided;
  if (!Array.isArray(services) || services.length === 0) return false;

  const normalized = services.map((s) => String(s).trim().toLowerCase());
  return normalized.includes('both') || normalized.includes(jobType);
}

/**
 * Accepted / auto-accepted businesses first (up to `slotCount`), then how many
 * grey skeleton slots are needed to always show `slotCount` rows.
 */
export function splitAcceptedAndPendingSlots(
  businesses: BusinessProfile[],
  slotCount = TARGET_MATCH_SLOTS,
): { accepted: BusinessProfile[]; skeletonCount: number } {
  const accepted = businesses.filter(isAcceptedBusiness).slice(0, slotCount);

  return {
    accepted,
    skeletonCount: Math.max(0, slotCount - accepted.length),
  };
}
