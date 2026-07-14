import { ArrowLeft } from 'lucide-react';
import { WizardPrimaryButton } from './WizardPrimaryButton';

interface NavButtonsProps {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showBack?: boolean;
  loading?: boolean;
}

export function NavButtons({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  showBack = true,
  loading = false,
}: NavButtonsProps) {
  return (
    <div
      className={`mt-auto flex items-stretch gap-3 pt-8 ${showBack ? '' : 'justify-end'}`}
    >
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 px-5 py-3.5 text-sm font-medium text-heading transition-colors hover:bg-gray-200"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back
        </button>
      )}
      <WizardPrimaryButton
        onClick={onContinue}
        disabled={continueDisabled}
        loading={loading}
        fullWidth={!showBack}
      >
        {continueLabel}
      </WizardPrimaryButton>
    </div>
  );
}
