import { WizardForm } from './WizardForm';

interface WizardPageProps {
  onComplete: () => void;
}

export function WizardPage({ onComplete }: WizardPageProps) {
  return (
    <div className="relative min-h-svh bg-surface">
      <WizardForm onComplete={onComplete} />
    </div>
  );
}
