import { Home, MessageSquare, User } from 'lucide-react';
import { AppLogo } from '../layout/AppLogo';
import type { NavTab } from '../../types/nav';
import { getFirstName } from '../../types/user';
import type { UserDocument } from '../../types/user';

interface SidebarProps {
  user: UserDocument;
  active: NavTab;
  onChange: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'profile', label: 'Profile', icon: User },
];

export function Sidebar({ user, active, onChange }: SidebarProps) {
  const firstName = getFirstName(user.fullName);
  const avatarUrl = user.photoUrls?.[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-navy lg:flex xl:w-[260px]">
      <div className="px-5 pt-6 pb-8">
        <AppLogo variant="light" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`relative flex items-center gap-3 rounded-lg px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                isActive
                  ? 'bg-navy-active text-white'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
              )}
              <Icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-brand' : ''}`}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={firstName}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-light text-[12px] font-semibold text-white ring-2 ring-white/20">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{firstName}</p>
            <p className="truncate text-[11px] text-white/50">Customer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
