import type { RtdbChatMessage } from '../../types/chat';
import { formatMessageTime } from '../../utils/formatRelativeTime';
import { MessageStatusIcon } from './MessageStatusIcon';

interface MessageBubbleProps {
  message: RtdbChatMessage;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[82%] rounded-lg px-3 py-2 shadow-sm ${
          isOwn
            ? 'rounded-br-none bg-[#d9fdd3] text-[#111b21]'
            : 'rounded-bl-none border border-[#e9edef] bg-white text-[#111b21]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.35]">
          {message.text}
        </p>

        <div
          className={`mt-1 flex items-center justify-end gap-1 ${
            isOwn ? 'text-[#667781]' : 'text-[#8696a0]'
          }`}
        >
          <span className="text-[11px] leading-none">
            {formatMessageTime(message.timestamp)}
          </span>
          {isOwn && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
