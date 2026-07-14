import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

interface JobPostsSectionProps {
  children: ReactNode;
}

export function JobPostsSection({ children }: JobPostsSectionProps) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <h2 className="shrink-0 text-[12px] font-bold tracking-[0.12em] text-body uppercase">
          Job Posts
        </h2>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-body" />
          <input
            type="search"
            placeholder="Search jobs..."
            className="h-9 w-full rounded-lg border border-border bg-white pr-3 pl-9 text-[12px] text-heading placeholder:text-body outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </div>
      </div>
      {children}
    </section>
  );
}
