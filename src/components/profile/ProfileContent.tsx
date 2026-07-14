import type { ReactNode } from 'react';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Settings,
} from 'lucide-react';
import type { UserDocument } from '../../types/user';
import { getFirstName } from '../../types/user';
import { formatPhoneDisplay } from '../../utils/phone';

interface ProfileMenuItemProps {
  icon: typeof ClipboardList;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}

function ProfileMenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: ProfileMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          danger ? 'bg-red-50' : 'bg-brand-light'
        }`}
      >
        <Icon
          className={`h-4 w-4 ${danger ? 'text-red-500' : 'text-brand'}`}
          strokeWidth={1.75}
        />
      </div>
      <span
        className={`flex-1 text-[14px] font-medium ${
          danger ? 'text-red-500' : 'text-[#111827]'
        }`}
      >
        {label}
      </span>
      {!danger && (
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" strokeWidth={2} />
      )}
    </button>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-[#9ca3af] uppercase">
        {title}
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {children}
      </div>
    </div>
  );
}

export function ProfilePageHeader() {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-white lg:hidden">
      <div className="flex h-[52px] w-full items-center justify-between px-4">
        <span className="text-[17px] font-bold text-heading">Profile</span>
        <button
          type="button"
          className="text-body"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}

export function ProfilePageTitle() {
  return (
    <div className="mb-6 hidden lg:block">
      <h1 className="text-[28px] font-bold tracking-tight text-heading">Profile</h1>
      <p className="mt-1 text-[14px] text-body">Manage your account and preferences</p>
    </div>
  );
}

interface ProfileBannerProps {
  user: UserDocument;
}

export function ProfileBanner({ user }: ProfileBannerProps) {
  const firstName = getFirstName(user.fullName);
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <div className="relative mt-8">
      <div className="absolute -top-5 left-4 z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#f8fafc] bg-white shadow-sm">
        {user.photoUrls?.[0] ? (
          <img
            src={user.photoUrls[0]}
            alt={user.fullName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="text-xl font-bold text-brand">{initial}</span>
        )}
      </div>

      <div className="relative rounded-2xl bg-brand px-5 pt-10 pb-5">
        <button
          type="button"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          aria-label="Edit profile"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <p className="text-[20px] font-bold text-white">{user.fullName}</p>

        <div className="mt-4 space-y-2.5">
          <p className="flex items-center gap-2.5 text-[13px] text-white/95">
            <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{user.email}</span>
          </p>
          <p className="flex items-center gap-2.5 text-[13px] text-white/95">
            <Phone className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{formatPhoneDisplay(user.phone)}</span>
          </p>
          <p className="flex items-center gap-2.5 text-[13px] text-white/95">
            <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{user.location}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

interface ProfileMenuProps {
  onLogout: () => void;
  onMyJobs: () => void;
  onNotifications: () => void;
  onHelp: () => void;
}

export function ProfileMenu({
  onLogout,
  onMyJobs,
  onNotifications,
  onHelp,
}: ProfileMenuProps) {
  return (
    <div className="space-y-5">
      <ProfileSection title="My Information">
        <ProfileMenuItem icon={ClipboardList} label="My Jobs" onClick={onMyJobs} />
      </ProfileSection>

      <ProfileSection title="App Settings">
        <ProfileMenuItem
          icon={Bell}
          label="Notifications"
          onClick={onNotifications}
        />
      </ProfileSection>

      <ProfileSection title="Support">
        <div className="divide-y divide-gray-100">
          <ProfileMenuItem
            icon={HelpCircle}
            label="Help & Support"
            onClick={onHelp}
          />
          <ProfileMenuItem
            icon={LogOut}
            label="Log Out"
            danger
            onClick={onLogout}
          />
        </div>
      </ProfileSection>
    </div>
  );
}
