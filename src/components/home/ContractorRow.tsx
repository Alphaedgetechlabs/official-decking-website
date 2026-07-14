import { MessageSquare } from 'lucide-react';
import type { JobContractor } from '../../data/jobContractors';

interface ContractorRowProps {
  contractor: JobContractor;
  onMessage?: (contractorId: string) => void;
}

export function ContractorRow({ contractor, onMessage }: ContractorRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${contractor.avatarBg} ${contractor.avatarText}`}
      >
        {contractor.initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold leading-tight text-[#111827]">
          {contractor.name}
        </p>
        <p className="mt-1 truncate text-[12px] leading-snug text-[#6b7280]">
          {contractor.specialty} • {contractor.rating} ({contractor.reviews}{' '}
          reviews)
        </p>
      </div>

      <button
        type="button"
        onClick={() => onMessage?.(contractor.id)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand-light text-brand transition-colors hover:bg-brand/10"
        aria-label={`Message ${contractor.name}`}
      >
        <MessageSquare className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </button>
    </div>
  );
}
