import type { PendingMediaUpload } from '../../types/chat';
import { CircularProgress } from './CircularProgressIndicator';

interface PendingMediaBubbleProps {
  upload: PendingMediaUpload;
}

export function PendingMediaBubble({ upload }: PendingMediaBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="relative max-w-[72%] overflow-hidden rounded-lg rounded-br-none bg-[#d9fdd3] shadow-sm">
        {upload.previewUrl ? (
          <div className="relative">
            {upload.mediaType === 'video' ? (
              <video
                src={upload.previewUrl}
                muted
                playsInline
                className="max-h-52 w-full object-cover opacity-70"
              />
            ) : (
              <img
                src={upload.previewUrl}
                alt="Uploading"
                className="max-h-52 w-full object-cover opacity-70"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <CircularProgress progress={upload.progress} />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[88px] min-w-[140px] items-center justify-center bg-[#c8f0c0] px-4 py-6">
            <CircularProgress progress={upload.progress} />
          </div>
        )}
      </div>
    </div>
  );
}
