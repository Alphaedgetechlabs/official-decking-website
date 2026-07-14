import { Bell } from 'lucide-react';
import { AppLogo } from '../layout/AppLogo';

interface HomeTopBarProps {
  unreadCount?: number;
  onNotificationsClick?: () => void;
}

export function HomeTopBar({
  unreadCount = 0,
  onNotificationsClick,
}: HomeTopBarProps) {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-white lg:hidden">
      <div className="flex h-[52px] w-full items-center justify-between px-4">
        <AppLogo showSubtitle={false} />

        <button
          type="button"
          onClick={onNotificationsClick}
          className="relative flex shrink-0 items-center justify-center text-heading"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

interface HomeGreetingProps {
  firstName: string;
}

export function HomeGreeting({ firstName }: HomeGreetingProps) {
  return (
    <div className="mb-6 lg:mb-8">
      <h1 className="text-[26px] font-bold leading-[1.15] tracking-tight text-heading lg:text-[32px]">
        Hello, {firstName}
      </h1>
      <p className="mt-2 text-[14px] leading-snug text-body">
        You can connect with your tradies now.
      </p>
    </div>
  );
}
