import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface WizardPrimaryButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function WizardPrimaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
}: WizardPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center justify-center gap-2 rounded-lg py-3.5 text-[15px] font-semibold transition-colors ${
        fullWidth ? 'w-full' : 'min-w-[140px] flex-1'
      } ${
        isDisabled
          ? 'cursor-not-allowed bg-gray-200 text-gray-400'
          : 'bg-brand text-white hover:bg-[#d96f42] active:bg-[#c9653a]'
      } ${className}`}
    >
      <span>{loading ? 'Submitting...' : children}</span>
      {!loading && (
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      )}
    </button>
  );
}
