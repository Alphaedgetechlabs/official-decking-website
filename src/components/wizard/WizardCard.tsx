import type { ReactNode } from 'react';

interface WizardCardProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function WizardCard({
  children,
  className = '',
  compact = false,
}: WizardCardProps) {
  return (
    <div
      className={`flex w-full flex-col rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${
        compact
          ? 'max-w-md px-6 py-8 sm:px-8'
          : 'min-h-[680px] max-w-[520px] px-7 py-12 sm:px-9 sm:py-14'
      } ${className}`}
    >
      {children}
    </div>
  );
}
