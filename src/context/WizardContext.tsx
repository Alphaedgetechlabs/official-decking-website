import { createContext, useContext, useState, type ReactNode } from 'react';
import type { BusinessProfile } from '../services/businessService';
import { INITIAL_FORM_DATA, type WizardFormData } from '../types/wizard';

export type WizardVariant = 'signup' | 'addJob';

interface WizardContextValue {
  step: number;
  formData: WizardFormData;
  variant: WizardVariant;
  totalSteps: number;
  matchedBusinesses: BusinessProfile[];
  setMatchedBusinesses: (businesses: BusinessProfile[]) => void;
  setStep: (step: number) => void;
  updateFormData: (data: Partial<WizardFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetWizard: (data?: Partial<WizardFormData>) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  children: ReactNode;
  variant?: WizardVariant;
  initialFormData?: Partial<WizardFormData>;
  initialMatchedBusinesses?: BusinessProfile[];
  initialStep?: number;
  onBackFromOtp?: () => void;
}

const TOTAL_STEPS: Record<WizardVariant, number> = {
  signup: 6,
  addJob: 5,
};

export function WizardProvider({
  children,
  variant = 'signup',
  initialFormData,
  initialMatchedBusinesses = [],
  initialStep = 1,
  onBackFromOtp,
}: WizardProviderProps) {
  const totalSteps = TOTAL_STEPS[variant];
  const [step, setStep] = useState(initialStep);
  const [formData, setFormData] = useState<WizardFormData>({
    ...INITIAL_FORM_DATA,
    ...initialFormData,
  });
  const [matchedBusinesses, setMatchedBusinesses] = useState<BusinessProfile[]>(
    initialMatchedBusinesses,
  );

  const updateFormData = (data: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
  const prevStep = () => {
    if (step === 5 && onBackFromOtp) {
      onBackFromOtp();
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const resetWizard = (data?: Partial<WizardFormData>) => {
    setStep(1);
    setFormData({ ...INITIAL_FORM_DATA, ...data });
    setMatchedBusinesses(initialMatchedBusinesses);
  };

  return (
    <WizardContext.Provider
      value={{
        step,
        formData,
        variant,
        totalSteps,
        matchedBusinesses,
        setMatchedBusinesses,
        setStep,
        updateFormData,
        nextStep,
        prevStep,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
