import type { BusinessProfile } from '../../services/businessService';
import { BusinessProfileCard } from './BusinessProfileCard';

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
  skeletonCount = 3,
}: RandomBusinessProfilesProps) {
  if (loading) {
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

  if (variant === 'card') {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business) => (
          <BusinessProfileCard
            key={business.id}
            business={business}
            onMessage={onMessage}
            variant="card"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {businesses.map((business) => (
        <BusinessProfileCard
          key={business.id}
          business={business}
          onMessage={onMessage}
          variant="row"
        />
      ))}
    </div>
  );
}
