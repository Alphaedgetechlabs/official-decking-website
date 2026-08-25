import { FileText, Play } from 'lucide-react';
import { useState } from 'react';
import type { RtdbChatMessage } from '../../types/chat';
import { formatMessageTime } from '../../utils/formatRelativeTime';
import { ChatMediaImageCard, ChatMediaVideoCard } from './ChatMediaImageCard';
import { MediaFullscreenViewer } from './MediaFullscreenViewer';
import { MessageStatusIcon } from './MessageStatusIcon';

interface MessageBubbleProps {
  message: RtdbChatMessage;
  isOwn: boolean;
}

function fileNameFromMediaUrl(mediaUrl: string | undefined): string | undefined {
  if (!mediaUrl) return undefined;
  try {
    const path = new URL(mediaUrl).pathname;
    const segment = decodeURIComponent(path.split('/').pop() ?? '');
    // Storage paths look like `1234_report.pdf` — strip leading timestamp_ when present
    const withoutTs = segment.replace(/^\d+_/, '');
    return withoutTs || segment || undefined;
  } catch {
    return undefined;
  }
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const hasMedia = Boolean(message.mediaUrl && message.mediaType);
  const hasCaption =
    Boolean(message.text) &&
    !['Photo', 'Video', 'Document'].includes(message.text) &&
    message.text !== message.fileName;
  const documentLabel =
    message.fileName ||
    fileNameFromMediaUrl(message.mediaUrl) ||
    'Attachment';

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-[82%] rounded-lg shadow-sm ${
            hasMedia ? 'overflow-hidden p-1' : 'px-3 py-2'
          } ${
            isOwn
              ? 'rounded-br-none bg-[#d9fdd3] text-[#111b21]'
              : 'rounded-bl-none border border-[#e9edef] bg-white text-[#111b21]'
          }`}
        >
          {hasMedia && message.mediaType === 'image' && message.mediaUrl && (
            <ChatMediaImageCard
              src={message.mediaUrl}
              alt={message.fileName ?? 'Shared image'}
              onClick={() => setViewerOpen(true)}
            />
          )}

          {hasMedia && message.mediaType === 'video' && message.mediaUrl && (
            <ChatMediaVideoCard
              mediaUrl={message.mediaUrl}
              thumbnailUrl={message.thumbnailUrl}
              fileName={message.fileName}
              onClick={() => setViewerOpen(true)}
              overlay={
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
                  </span>
                </span>
              }
            />
          )}

          {hasMedia && message.mediaType === 'document' && (
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-md px-2 py-2 ${
                isOwn ? 'bg-[#c8f0c0]/60' : 'bg-[#f0f2f5]'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isOwn ? 'bg-[#00a884]/15 text-[#00a884]' : 'bg-white text-[#54656f]'
                }`}
              >
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">
                  {documentLabel}
                </span>
                <span className="text-[11px] text-[#667781]">Tap to open</span>
              </span>
            </a>
          )}

          {(hasCaption || !hasMedia) && (
            <p
              className={`whitespace-pre-wrap break-words text-[14px] leading-[1.35] ${
                hasMedia ? 'px-2 pb-1 pt-1.5' : ''
              }`}
            >
              {message.text}
            </p>
          )}

          <div
            className={`flex items-center justify-end gap-1 ${
              hasMedia ? 'px-2 pb-1' : 'mt-1'
            } ${isOwn ? 'text-[#667781]' : 'text-[#8696a0]'}`}
          >
            <span className="text-[11px] leading-none">
              {formatMessageTime(message.timestamp)}
            </span>
            {isOwn && <MessageStatusIcon status={message.status} />}
          </div>
        </div>
      </div>

      {viewerOpen && hasMedia && message.mediaUrl && message.mediaType && (
        <MediaFullscreenViewer
          mediaUrl={message.mediaUrl}
          mediaType={message.mediaType}
          thumbnailUrl={message.thumbnailUrl}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
