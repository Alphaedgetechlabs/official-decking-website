import { Fence } from 'lucide-react';
import { currentJobType, tradeLabel } from '../../config/brandDomain';
import { useJobAcceptedBusinesses } from '../../hooks/useJobAcceptedBusinesses';
import {
  labelsFromJobType,
  type UserJobListItem,
} from '../../services/jobService';
import type { BusinessProfile } from '../../services/businessService';
import { TARGET_MATCH_SLOTS } from '../../utils/businessMatchStatus';
import { BusinessProfileCard } from './BusinessProfileCard';
import { TradieRowSkeleton } from './TradieRowSkeleton';

interface JobPostCardProps {
  job: UserJobListItem;
  /** Kept for call-site compatibility; slots use jobs/{id}.acceptedBy instead. */
  businesses?: BusinessProfile[];
  businessesLoading?: boolean;
  businessesError?: string | null;
  onMessageContractor?: (businessId: string) => void;
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case 'accepted':
      return 'bg-[#fff0e8] text-brand';
    case 'completed':
      return 'bg-green-50 text-green-700';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-[#fff8f3] text-[#c96f45]';
  }
}

export function JobPostCard({
  job,
  onMessageContractor,
}: JobPostCardProps) {
  const {
    businesses: acceptedForJob,
    skeletonCount,
    loading,
  } = useJobAcceptedBusinesses(job.id);

  const skeletonSlots = loading ? TARGET_MATCH_SLOTS : skeletonCount;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe]">
          <Fence className="h-[18px] w-[18px] text-[#4a7fd4]" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight text-heading">
            {job.title}
          </p>
          <p className="mt-1 text-[12px] leading-none text-body">
            created {job.createdDate} • {job.category}
          </p>
          {job.location && (
            <p className="mt-1 truncate text-[12px] text-body">{job.location}</p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${statusClass(job.status)}`}
        >
          {job.status}
        </span>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: skeletonSlots }).map((_, i) => (
            <TradieRowSkeleton key={`loading-slot-${i}`} />
          ))}
        </div>
      ) : (
        <div>
          {acceptedForJob.map((business) => (
            <BusinessProfileCard
              key={business.id}
              business={business}
              onMessage={onMessageContractor}
              variant="row"
            />
          ))}
          {Array.from({ length: skeletonSlots }).map((_, i) => (
            <TradieRowSkeleton key={`pending-slot-${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}

interface JobPostsListProps {
  jobs: UserJobListItem[];
  loading?: boolean;
  error?: string | null;
  businesses: BusinessProfile[];
  businessesLoading?: boolean;
  businessesError?: string | null;
  onMessageContractor?: (businessId: string) => void;
}

export function JobPostsList({
  jobs,
  loading,
  error,
  businesses,
  businessesLoading,
  businessesError,
  onMessageContractor,
}: JobPostsListProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white px-4 py-10 text-center text-sm text-body">
        Loading your job posts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    const emptyLabels = labelsFromJobType(currentJobType);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe]">
            <Fence className="h-[18px] w-[18px] text-[#4a7fd4]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-tight text-heading">
              {emptyLabels.title}
            </p>
            <p className="mt-1 text-[12px] leading-none text-body">
              Tap + to post your first {tradeLabel} job
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobPostCard
          key={job.id}
          job={job}
          businesses={businesses}
          businessesLoading={businessesLoading}
          businessesError={businessesError}
          onMessageContractor={onMessageContractor}
        />
      ))}
    </div>
  );
}
