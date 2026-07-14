import { useWizard } from '../../context/WizardContext';
import { Step1Location } from '../wizard/Step1Location';
import { Step2Timeline } from '../wizard/Step2Timeline';
import { Step3JobDescription } from '../wizard/Step3JobDescription';
import { Step4AddJobContact } from '../wizard/Step4AddJobContact';
import { Step5Matching } from '../wizard/Step5Matching';

interface AddJobWizardProps {
  uid: string;
  userId: string;
  onComplete: () => void;
}

export function AddJobWizard({ uid, userId, onComplete }: AddJobWizardProps) {
  const { step } = useWizard();

  return (
    <>
      {step === 1 && <Step1Location />}
      {step === 2 && <Step2Timeline />}
      {step === 3 && <Step3JobDescription />}
      {step === 4 && <Step4AddJobContact uid={uid} userId={userId} />}
      {step === 5 && <Step5Matching onComplete={onComplete} />}
    </>
  );
}
