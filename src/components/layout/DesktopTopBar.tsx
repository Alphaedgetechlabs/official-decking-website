import { Bell, ChevronDown, Search } from 'lucide-react';

interface DesktopTopBarProps {
  firstName: string;
  avatarUrl?: string;
  unreadCount?: number;
  onNotificationsClick?: () => void;
}

export function DesktopTopBar({
  firstName,
  avatarUrl,
  unreadCount = 0,
  onNotificationsClick,
}: DesktopTopBarProps) {
  return (
    <header className="sticky top-0 z-10 hidden shrink-0 border-b border-border bg-white lg:block">
      <div className="flex h-[60px] items-center gap-4 px-8">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            type="search"
            placeholder="Search jobs, tradies, messages..."
            className="h-10 w-full rounded-xl border border-border bg-surface pr-4 pl-10 text-[13px] text-heading placeholder:text-body outline-none transition-shadow focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
        </div>

        <button
          type="button"
          onClick={onNotificationsClick}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-heading transition-colors hover:bg-surface"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border px-3 py-1.5 transition-colors hover:bg-surface"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={firstName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-light text-[12px] font-semibold text-white">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-semibold text-heading">{firstName}</span>
          <ChevronDown className="h-4 w-4 text-body" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
