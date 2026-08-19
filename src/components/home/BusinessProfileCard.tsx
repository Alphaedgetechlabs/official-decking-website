import { MessageSquare } from 'lucide-react';
import type { BusinessProfile } from '../../services/businessService';
import { BusinessAvatar } from '../ui/BusinessAvatar';

interface BusinessProfileCardProps {
  business: BusinessProfile;
  onMessage?: (businessId: string) => void;
  variant?: 'row' | 'card';
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

export function BusinessProfileCard({
  business,
  onMessage,
  variant = 'row',
}: BusinessProfileCardProps) {
  const description = truncateWords(business.description || '', 20);
  const rating = business.rating || 0;
  const reviews = business.reviewCount || 0;

  if (variant === 'card') {
    return (
      <div className="rounded-xl border border-border bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BusinessAvatar
              businessName={business.businessName}
              logoUrl={business.logoUrl}
              className="h-10 w-10 shrink-0 text-[12px] font-semibold"
            />
            <div>
              <p className="text-[14px] font-bold text-heading">
                {business.businessName}
              </p>
              <p className="mt-0.5 text-[12px] text-body">
                {rating} ★ · {reviews} reviews
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onMessage?.(business.id)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand-light text-brand transition-colors hover:bg-brand/10"
            aria-label={`Message ${business.businessName}`}
          >
            <MessageSquare className="h-[17px] w-[17px]" strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-3 text-[12px] text-body">
          {description} · Available for your job
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <BusinessAvatar
        businessName={business.businessName}
        logoUrl={business.logoUrl}
        className="h-10 w-10 shrink-0 text-[12px] font-semibold"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold leading-tight text-heading">
          {business.businessName}
        </p>
        <p className="mt-1 truncate text-[12px] leading-snug text-body">
          {description} • {rating} ({reviews} reviews)
        </p>
      </div>

      <button
        type="button"
        onClick={() => onMessage?.(business.id)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand-light text-brand transition-colors hover:bg-brand/10"
        aria-label={`Message ${business.businessName}`}
      >
        <MessageSquare className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </button>
    </div>
  );
}
