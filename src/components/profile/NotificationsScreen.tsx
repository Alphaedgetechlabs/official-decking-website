import {
  Bell,
  Briefcase,
  CheckCircle,
  FileText,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import type { AppNotification } from '../../types/notification';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { SubPageHeader } from './SubPageHeader';

interface NotificationsScreenProps {
  onBack: () => void;
  onOpenChat?: (businessId: string) => void;
}

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  const iconClass = 'h-4 w-4';
  const wrapClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg';

  switch (type) {
    case 'quote':
      return (
        <div className={`${wrapClass} bg-[#e8f0fe]`}>
          <FileText className={`${iconClass} text-[#4a7fd4]`} strokeWidth={1.75} />
        </div>
      );
    case 'message':
      return (
        <div className={`${wrapClass} bg-brand-light`}>
          <MessageSquare className={`${iconClass} text-brand`} strokeWidth={1.75} />
        </div>
      );
    case 'job_accepted':
      return (
        <div className={`${wrapClass} bg-emerald-50`}>
          <CheckCircle className={`${iconClass} text-emerald-600`} strokeWidth={1.75} />
        </div>
      );
    case 'job_rejected':
      return (
        <div className={`${wrapClass} bg-red-50`}>
          <XCircle className={`${iconClass} text-red-500`} strokeWidth={1.75} />
        </div>
      );
    case 'system':
    default:
      return (
        <div className={`${wrapClass} bg-gray-100`}>
          <Bell className={`${iconClass} text-body`} strokeWidth={1.75} />
        </div>
      );
  }
}

function NotificationCard({
  item,
  onClick,
}: {
  item: AppNotification;
  onClick: () => void;
}) {
  const isJobType =
    item.type === 'job_accepted' || item.type === 'job_rejected';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors hover:border-brand/30 ${
        item.read
          ? 'border-border bg-white'
          : 'border-brand/25 bg-brand-light/50'
      }`}
    >
      <div className="flex gap-3">
        <NotificationIcon type={isJobType ? item.type : item.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-bold text-heading">{item.title}</p>
            <span
              className={`shrink-0 text-[11px] ${
                item.read ? 'text-body' : 'font-medium text-brand'
              }`}
            >
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-body">
            {item.body}
          </p>
          {!item.read && (
            <span className="mt-2 inline-block rounded bg-brand px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
              new
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function NotificationsScreen({
  onBack,
  onOpenChat,
}: NotificationsScreenProps) {
  const { notifications, loading, markRead, markAllRead, getUnreadCount } =
    useNotificationStore();

  const unreadCount = getUnreadCount();

  const handleItemClick = (item: AppNotification) => {
    void markRead(item.id);

    if (
      (item.type === 'message' || item.type === 'job_accepted') &&
      item.businessId
    ) {
      onOpenChat?.(item.businessId);
    }
  };

  return (
    <div className="min-h-svh bg-surface">
      <SubPageHeader title="Notifications" onBack={onBack} />
      <div className="mx-auto w-full max-w-[480px] lg:max-w-3xl lg:px-8">
        <main className="px-5 pt-5 pb-24 lg:px-0 lg:pt-8 lg:pb-10">
          <div className="mb-4 hidden lg:block">
            <h1 className="text-[28px] font-bold tracking-tight text-heading">
              Notifications
            </h1>
            <p className="mt-1 text-[14px] text-body">
              Alerts from your tradies and job updates
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-[0.12em] text-body uppercase">
              Recent Alerts
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[12px] font-semibold text-brand hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <p className="mb-3 text-[12px] text-body">
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
          )}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-border bg-white py-12 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-body" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] font-medium text-heading">
                No notifications yet
              </p>
              <p className="mt-1 text-[12px] text-body">
                You&apos;ll be notified when tradies message, accept, or decline
                your jobs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
