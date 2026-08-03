import { AlertCircle, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { useWizard } from '../../context/WizardContext';
import { queueAdditionalJob } from '../../services/jobService';
import { formatPhoneForAuth, isValidPhoneInput } from '../../utils/phone';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';

interface Step4AddJobContactProps {
  uid: string;
  userId: string;
}

export function Step4AddJobContact({ uid, userId }: Step4AddJobContactProps) {
  const { formData, updateFormData, prevStep, nextStep, setStaggerAcceptPlan } = useWizard();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValid =
    formData.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    isValidPhoneInput(formData.phone);

  const handleContinue = () => {
    if (!isValid) return;

    setSubmitError(null);
    const normalizedPhone = formatPhoneForAuth(formData.phone);
    updateFormData({ phone: normalizedPhone });

    queueAdditionalJob(
      { ...formData, phone: normalizedPhone },
      uid,
      userId,
      (result) => {
        setStaggerAcceptPlan(result.staggerAcceptPlan);
      },
    );
    nextStep();
  };

  const inputClass =
    'w-full rounded-lg border border-border px-4 py-3.5 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30';

  return (
    <StepShell>
      <ProgressHeader step={4} />

      <h1 className="text-center text-lg font-bold leading-tight text-heading">
        Confirm your contact details
      </h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-body">
        Your tradies will use these details to send quotes.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="addJobFullName"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <User className="h-4 w-4" strokeWidth={2} />
            Full Name
          </label>
          <input
            id="addJobFullName"
            type="text"
            value={formData.fullName}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            placeholder="John Smith"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="addJobEmail"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <Mail className="h-4 w-4" strokeWidth={2} />
            Email Address
          </label>
          <input
            id="addJobEmail"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="john@example.com"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="addJobPhone"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <Phone className="h-4 w-4" strokeWidth={2} />
            Best Phone Number
          </label>
          <input
            id="addJobPhone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateFormData({ phone: e.target.value })}
            placeholder="03XX XXXXXXX, +92 3XX…, 04XX XXX XXX, or +61…"
            className={inputClass}
          />
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
            strokeWidth={2}
          />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Could not post job
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-600">
              {submitError}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <p className="flex items-center gap-2 text-xs text-body">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
          Zero spam — ever
        </p>
        <p className="flex items-center gap-2 text-xs text-body">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
          Your details are private and secure
        </p>
      </div>

      <NavButtons
        onBack={prevStep}
        continueLabel="Post Job"
        continueDisabled={!isValid}
        onContinue={handleContinue}
      />
    </StepShell>
  );
}
