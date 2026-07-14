import { Home, MessageSquare, User } from 'lucide-react';
import type { NavTab } from '../../types/nav';

interface BottomNavProps {
  active: NavTab;
  onChange: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex h-[62px] w-full max-w-[480px] items-stretch">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand" />
              )}
              <Icon
                className={`h-[22px] w-[22px] ${isActive ? 'text-brand' : 'text-body'}`}
                strokeWidth={isActive ? 2.25 : 1.75}
                fill={isActive && id === 'home' ? 'currentColor' : 'none'}
              />
              <span
                className={`text-[11px] leading-none ${
                  isActive ? 'font-semibold text-brand' : 'font-medium text-body'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
