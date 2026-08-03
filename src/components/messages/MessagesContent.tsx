import { Search, Star } from 'lucide-react';
import type { MessageItem } from '../../data/messages';

function MessageAvatar({ message }: { message: MessageItem }) {
  return (
    <div className="relative shrink-0">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-bold ${message.avatarBg} ${message.avatarText}`}
      >
        {message.initials}
      </div>
      {message.isOnline && (
        <span
          className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand"
          aria-label="Online"
        />
      )}
    </div>
  );
}

interface MessageCardProps {
  message: MessageItem;
  onClick: () => void;
}

export function MessageCard({ message, onClick }: MessageCardProps) {
  const isUnread = Boolean(message.unread);
  const noConversation =
    !message.hasConversation || message.preview === 'No conversation';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors hover:border-brand/30 ${
        isUnread
          ? 'border-brand/25 bg-brand-light/60'
          : 'border-border bg-white'
      }`}
    >
      <div className="flex gap-3">
        <MessageAvatar message={message} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="truncate text-[14px] font-bold text-heading">
                {message.name}
              </span>
              {!message.isAdmin && (
                <>
                  <Star
                    className="h-3 w-3 shrink-0 text-brand"
                    fill="#e87a4d"
                    strokeWidth={0}
                  />
                  <span className="shrink-0 text-[12px] font-semibold text-heading">
                    {message.rating}
                  </span>
                </>
              )}
            </div>
            {message.hasConversation && message.time && (
              <span
                className={`shrink-0 text-[11px] ${
                  isUnread ? 'font-medium text-brand' : 'text-body'
                }`}
              >
                {message.time}
              </span>
            )}
          </div>

          <p
            className={`mt-1.5 truncate text-[12px] ${
              noConversation ? 'text-body/70 italic' : 'text-body'
            }`}
          >
            {message.preview}
          </p>

          {message.hasConversation && message.status && (
            <p
              className={`mt-2 text-[11px] ${
                isUnread ? 'font-medium text-brand' : 'text-body'
              }`}
            >
              {message.status}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function MessagesHeader() {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-white lg:hidden">
      <div className="flex h-[52px] w-full items-center justify-between px-4">
        <span className="text-[17px] font-bold text-heading">Messages</span>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-body transition-colors hover:bg-surface"
          aria-label="Search messages"
        >
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}

export function MessagesPageTitle() {
  return (
    <div className="mb-6 hidden lg:block">
      <h1 className="text-[28px] font-bold tracking-tight text-heading">Messages</h1>
      <p className="mt-1 text-[14px] text-body">Your conversations with tradies</p>
    </div>
  );
}
