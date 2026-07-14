interface OrangeDotsLoaderProps {
  message?: string;
  className?: string;
}

export function OrangeDotsLoader({ message, className = '' }: OrangeDotsLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-8 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-end justify-center gap-2">
        <span className="loading-dot-bounce h-3 w-3 rounded-full bg-brand" />
        <span className="loading-dot-bounce loading-dot-bounce-2 h-3 w-3 rounded-full bg-brand" />
        <span className="loading-dot-bounce loading-dot-bounce-3 h-3 w-3 rounded-full bg-brand" />
      </div>
      {message && (
        <p className="text-sm font-medium text-body">{message}</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
