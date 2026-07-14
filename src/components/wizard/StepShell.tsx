import type { ReactNode } from 'react';
import { useWizard } from '../../context/WizardContext';
import { WizardCard } from './WizardCard';

interface StepShellProps {
  children: ReactNode;
  className?: string;
}

export function StepShell({ children, className = '' }: StepShellProps) {
  const { variant } = useWizard();

  if (variant === 'addJob') {
    return (
      <div className={`flex flex-1 flex-col overflow-y-auto ${className}`}>
        {children}
      </div>
    );
  }

  return <WizardCard className={className}>{children}</WizardCard>;
}
