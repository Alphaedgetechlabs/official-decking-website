import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ChatMediaType } from '../../types/chat';

interface MediaFullscreenViewerProps {
  mediaUrl: string;
  mediaType: ChatMediaType;
  thumbnailUrl?: string;
  onClose: () => void;
}

export function MediaFullscreenViewer({
  mediaUrl,
  mediaType,
  thumbnailUrl,
  onClose,
}: MediaFullscreenViewerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="max-h-full max-w-full"
        onClick={(event) => event.stopPropagation()}
      >
        {mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />
        ) : mediaType === 'video' ? (
          <video
            src={mediaUrl}
            poster={thumbnailUrl}
            controls
            autoPlay
            playsInline
            className="max-h-[90vh] max-w-[90vw] rounded-md bg-black"
          />
        ) : (
          <div className="rounded-lg bg-white p-6 text-center">
            <p className="text-[15px] font-medium text-[#111b21]">
              Document preview unavailable
            </p>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[14px] font-medium text-[#00a884] hover:underline"
            >
              Open document
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
