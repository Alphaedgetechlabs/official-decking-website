import { useWizard } from '../../context/WizardContext';

interface ProgressHeaderProps {
  step: number;
  totalSteps?: number;
}

export function ProgressHeader({ step, totalSteps: totalStepsProp }: ProgressHeaderProps) {
  const { variant, totalSteps: contextTotalSteps } = useWizard();
  const totalSteps = totalStepsProp ?? contextTotalSteps;
  const percent = Math.round((step / totalSteps) * 100);

  if (variant === 'addJob') {
    return (
      <p className="mb-2 text-center text-[11px] font-bold tracking-[0.14em] text-brand uppercase">
        Step {step} of {totalSteps}
      </p>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-body">
          Step {step} of {totalSteps}
        </span>
        <span className="font-medium text-brand">{percent}% Complete</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-track">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
