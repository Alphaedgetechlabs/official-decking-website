import { Skeleton } from '../ui/skeleton';

/** Matches the home tradie row layout while a business is still pending accept. */
export function TradieRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0"
      aria-hidden="true"
    >
      <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28 bg-gray-200" />
        <Skeleton className="h-3 w-44 max-w-full bg-gray-200" />
      </div>
      <Skeleton className="h-9 w-9 shrink-0 rounded-lg bg-gray-200" />
    </div>
  );
}
