import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircularProgress } from './CircularProgressIndicator';

const MEDIA_CARD_CLASS =
  'relative min-h-[180px] w-full min-w-[200px] max-h-64 overflow-hidden rounded-md bg-[#e9edef]';

interface ChatMediaImageCardProps {
  src: string;
  alt: string;
  onClick?: () => void;
  overlay?: ReactNode;
}

export function ChatMediaImageCard({
  src,
  alt,
  onClick,
  overlay,
}: ChatMediaImageCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const handleImageRef = (img: HTMLImageElement | null) => {
    imgRef.current = img;
    if (img?.complete && img.naturalHeight > 0) {
      setLoaded(true);
    }
  };

  const content = (
    <>
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#e9edef]">
          <CircularProgress indeterminate />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#e9edef] px-3 text-center text-[12px] text-[#667781]">
          Unable to load image
        </div>
      )}

      <img
        ref={handleImageRef}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`max-h-64 w-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {loaded && overlay}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block ${MEDIA_CARD_CLASS}`}
      >
        {content}
      </button>
    );
  }

  return <div className={MEDIA_CARD_CLASS}>{content}</div>;
}

interface ChatMediaVideoCardProps {
  mediaUrl: string;
  thumbnailUrl?: string;
  fileName?: string;
  onClick?: () => void;
  overlay: ReactNode;
}

export function ChatMediaVideoCard({
  mediaUrl,
  thumbnailUrl,
  fileName,
  onClick,
  overlay,
}: ChatMediaVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);

    if (thumbnailUrl) return;

    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      setLoaded(true);
    }
  }, [mediaUrl, thumbnailUrl]);

  if (thumbnailUrl) {
    return (
      <ChatMediaImageCard
        src={thumbnailUrl}
        alt={fileName ?? 'Video thumbnail'}
        onClick={onClick}
        overlay={overlay}
      />
    );
  }

  const content = (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#e9edef]">
          <CircularProgress indeterminate />
        </div>
      )}

      <video
        ref={videoRef}
        src={mediaUrl}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        className={`max-h-64 w-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {loaded && overlay}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block ${MEDIA_CARD_CLASS}`}
      >
        {content}
      </button>
    );
  }

  return <div className={MEDIA_CARD_CLASS}>{content}</div>;
}
