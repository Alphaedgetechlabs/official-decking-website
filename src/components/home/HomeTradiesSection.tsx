import { RandomBusinessProfiles } from './RandomBusinessProfiles';
import type { BusinessProfile } from '../../services/businessService';

interface HomeTradiesSectionProps {
  businesses: BusinessProfile[];
  loading?: boolean;
  error?: string | null;
  onMessage?: (businessId: string) => void;
}

export function HomeTradiesSection({
  businesses,
  loading,
  error,
  onMessage,
}: HomeTradiesSectionProps) {
  return (
    <section>
      <h2 className="mb-4 text-[12px] font-bold tracking-[0.12em] text-body uppercase">
        Your Tradies
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <RandomBusinessProfiles
          businesses={businesses}
          loading={loading}
          error={error}
          onMessage={onMessage}
          variant="row"
        />
      </div>
    </section>
  );
}
