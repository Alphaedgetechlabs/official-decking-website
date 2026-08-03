import {
  ArrowLeft,
  Calendar,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Star,
} from 'lucide-react';
import type { UserJobListItem } from '../../services/jobService';
import type { BusinessProfile } from '../../services/businessService';
import {
  getBusinessAvatarStyle,
  getBusinessDisplayMeta,
  getBusinessInitials,
} from '../../utils/businessDisplay';

interface JobDetailScreenProps {
  job: UserJobListItem;
  businesses: BusinessProfile[];
  businessesLoading?: boolean;
  onBack: () => void;
  onMessage?: (businessId: string) => void;
}

function ContractorCard({
  business,
  onMessage,
}: {
  business: BusinessProfile;
  onMessage?: (businessId: string) => void;
}) {
  const initials = getBusinessInitials(business.businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(business.businessName);
  const { rating, reviews } = getBusinessDisplayMeta(business.businessName);
  const phone = business.phone?.trim();

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${avatarBg} ${avatarText}`}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-heading">
              {business.businessName}
            </p>
            <span className="rounded-full bg-[#fff0e8] px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
              Accepted
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <Star
              className="h-3.5 w-3.5 text-brand"
              fill="#e87a4d"
              strokeWidth={0}
            />
            <span className="text-[12px] font-semibold text-heading">
              {rating}
            </span>
            <span className="text-[12px] text-body">({reviews} reviews)</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <a
          href={phone ? `tel:${phone}` : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-[13px] font-semibold text-heading transition-colors ${
            phone
              ? 'hover:border-brand hover:bg-brand hover:text-white'
              : 'pointer-events-none opacity-50'
          }`}
        >
          <Phone className="h-4 w-4" strokeWidth={1.75} />
          Call
        </a>
        <button
          type="button"
          onClick={() => onMessage?.(business.id)}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-[13px] font-semibold text-heading transition-colors hover:bg-gray-100"
        >
          <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
          Message
        </button>
      </div>
    </div>
  );
}

export function JobDetailScreen({
  job,
  businesses,
  businessesLoading,
  onBack,
  onMessage,
}: JobDetailScreenProps) {
  return (
    <div className="min-h-svh bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-[52px] max-w-[480px] items-center gap-3 px-4 lg:max-w-3xl lg:px-8 lg:h-[60px]">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-heading"
            aria-label="Back to My Jobs"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="truncate text-[16px] font-bold text-heading lg:text-[18px]">
            {job.title}
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[480px] px-5 py-5 pb-24 lg:max-w-3xl lg:px-8 lg:pb-10">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
            Job Details
          </p>

          <div className="space-y-4">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-body" strokeWidth={1.75} />
              <div>
                <p className="text-[13px] font-bold text-heading">Location</p>
                <p className="mt-0.5 text-[13px] text-body">
                  {job.location || 'Location not specified'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-body" strokeWidth={1.75} />
              <div>
                <p className="text-[13px] font-bold text-heading">Created</p>
                <p className="mt-0.5 text-[13px] text-body">{job.createdDate}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-body" strokeWidth={1.75} />
              <div>
                <p className="text-[13px] font-bold text-heading">Description</p>
                <p className="mt-1 text-[13px] leading-relaxed text-body">
                  {job.description || 'No description provided for this job.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
            Accepted Your Job
          </p>

          {businessesLoading && (
            <div className="rounded-2xl border border-border bg-white px-4 py-8 text-center text-sm text-body">
              Loading tradies...
            </div>
          )}

          {!businessesLoading && businesses.length === 0 && (
            <div className="rounded-2xl border border-border bg-white px-4 py-8 text-center text-sm text-body">
              No tradies matched yet.
            </div>
          )}

          <div className="space-y-3">
            {businesses.map((business) => (
              <ContractorCard
                key={business.id}
                business={business}
                onMessage={onMessage}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
