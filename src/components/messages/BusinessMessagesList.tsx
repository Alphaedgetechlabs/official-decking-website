import { MessageSquare } from 'lucide-react';
import type { MessageItem } from '../../data/messages';
import { MessageCard } from '../messages/MessagesContent';

interface BusinessMessagesListProps {
  messages: MessageItem[];
  loading?: boolean;
  error?: string | null;
  onOpenChat: (businessId: string) => void;
}

export function BusinessMessagesList({
  messages,
  loading,
  error,
  onOpenChat,
}: BusinessMessagesListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-[13px] text-body">{error}</p>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-12 text-center">
        <MessageSquare
          className="mx-auto h-8 w-8 text-body"
          strokeWidth={1.5}
        />
        <p className="mt-3 text-[14px] font-medium text-heading">
          No tradies available
        </p>
        <p className="mt-1 text-[12px] text-body">
          Check back soon for businesses in your area.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageCard
          key={message.chatId}
          message={message}
          onClick={() => onOpenChat(message.businessId)}
        />
      ))}
    </div>
  );
}
