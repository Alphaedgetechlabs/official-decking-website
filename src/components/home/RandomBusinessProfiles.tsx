import type { BusinessProfile } from '../../services/businessService';
import {
  splitAcceptedAndPendingSlots,
  TARGET_MATCH_SLOTS,
} from '../../utils/businessMatchStatus';
import { BusinessProfileCard } from './BusinessProfileCard';
import { TradieRowSkeleton } from './TradieRowSkeleton';

interface RandomBusinessProfilesProps {
  businesses: BusinessProfile[];
  loading?: boolean;
  error?: string | null;
  onMessage?: (businessId: string) => void;
  variant?: 'row' | 'card';
  skeletonCount?: number;
}

export function RandomBusinessProfiles({
  businesses,
  loading,
  error,
  onMessage,
  variant = 'row',
  skeletonCount = TARGET_MATCH_SLOTS,
}: RandomBusinessProfilesProps) {
  if (loading) {
    if (variant === 'row') {
      return (
        <div>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <TradieRowSkeleton key={`loading-slot-${i}`} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-6 text-center text-[13px] text-body">{error}</p>
    );
  }

  if (businesses.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[13px] text-body">
        No business profiles available yet.
      </p>
    );
  }

  const { accepted, skeletonCount: pendingSlots } =
    splitAcceptedAndPendingSlots(businesses, skeletonCount);

  if (variant === 'card') {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {accepted.map((business) => (
          <BusinessProfileCard
            key={business.id}
            business={business}
            onMessage={onMessage}
            variant="card"
          />
        ))}
        {Array.from({ length: pendingSlots }).map((_, i) => (
          <div
            key={`pending-card-${i}`}
            className="h-28 animate-pulse rounded-xl bg-gray-100"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {accepted.map((business) => (
        <BusinessProfileCard
          key={business.id}
          business={business}
          onMessage={onMessage}
          variant="row"
        />
      ))}
      {Array.from({ length: pendingSlots }).map((_, i) => (
        <TradieRowSkeleton key={`pending-slot-${i}`} />
      ))}
    </div>
  );
}
