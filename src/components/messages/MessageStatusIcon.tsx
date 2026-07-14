import type { MessageStatus } from '../../types/chat';

interface MessageStatusIconProps {
  status: MessageStatus;
}

export function MessageStatusIcon({ status }: MessageStatusIconProps) {
  const isRead = status === 'read';
  const isDelivered = status === 'delivered' || isRead;
  const color = isRead ? 'text-[#53bdeb]' : 'text-[#8696a0]';

  if (status === 'sent') {
    return (
      <span className={`inline-flex ${color}`} aria-label="sent">
        <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
          <path
            d="M10.5 3L4.5 9 1.5 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${color}`} aria-label={status}>
      <svg
        className="h-4 w-4"
        viewBox="0 0 16 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
          fill="currentColor"
          opacity={isDelivered ? 1 : 0}
        />
        <path
          d="M10.91 3.316l-.477-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
