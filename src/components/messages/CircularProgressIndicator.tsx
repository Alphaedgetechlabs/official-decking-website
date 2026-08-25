interface CircularProgressProps {
  progress?: number;
  indeterminate?: boolean;
  size?: 'sm' | 'md';
}

export function CircularProgress({
  progress = 0,
  indeterminate = false,
  size = 'md',
}: CircularProgressProps) {
  const radius = size === 'sm' ? 14 : 18;
  const dimension = size === 'sm' ? 40 : 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const center = dimension / 2;

  if (indeterminate) {
    return (
      <div
        className={`relative flex items-center justify-center ${
          size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
        }`}
      >
        <svg
          className={`animate-spin ${size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'}`}
          viewBox={`0 0 ${dimension} ${dimension}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="3"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#8696a0"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
      }`}
    >
      <svg
        className={`${size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'} -rotate-90`}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="3"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-white">
        {Math.round(progress)}%
      </span>
    </div>
  );
}
