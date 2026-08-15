import { AlertCircle, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { PhoneAlreadyRegisteredError } from '../../errors/authErrors';
import { useWizard } from '../../context/WizardContext';
import {
  getAuthErrorMessage,
  resetRecaptchaVerifier,
} from '../../services/authService';
import { formatPhoneForAuth, isValidPhoneInput } from '../../utils/phone';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';

interface Step4ContactDetailsProps {
  onSendOtp: (phoneE164: string) => Promise<void>;
}

export function Step4ContactDetails({ onSendOtp }: Step4ContactDetailsProps) {
  const { formData, updateFormData, prevStep, nextStep } = useWizard();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValid =
    formData.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    isValidPhoneInput(formData.phone);

  const handleContinue = async () => {
    if (!isValid) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const phoneE164 = formatPhoneForAuth(formData.phone);
      updateFormData({ phone: phoneE164 });
      await onSendOtp(phoneE164);
      nextStep();
    } catch (error) {
      if (error instanceof PhoneAlreadyRegisteredError) {
        setSubmitError(
          'This phone number is already registered. Please use a different number to continue.',
        );
      } else {
        await resetRecaptchaVerifier();
        setSubmitError(
          getAuthErrorMessage(
            error,
            'Failed to send verification code. Please try again.',
          ),
        );
      }
      console.error('OTP send error:', error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border px-4 py-4 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30';

  const phoneInputClass = `${inputClass} ${
    submitError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''
  }`;

  return (
    <StepShell>
      <ProgressHeader step={4} />

      <h1 className="text-2xl font-bold leading-tight text-heading sm:text-[1.65rem]">
        Almost done! Your quotes are just minutes away.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-body">
        Enter your details so your decking professionals can send accurate pricing.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <User className="h-4 w-4" strokeWidth={2} />
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={formData.fullName}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            placeholder="John Smith"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <Mail className="h-4 w-4" strokeWidth={2} />
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="john@example.com"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
          >
            <Phone className="h-4 w-4" strokeWidth={2} />
            Best Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => {
              updateFormData({ phone: e.target.value });
              setSubmitError(null);
            }}
            placeholder="03XX XXXXXXX, +92 3XX…, 04XX XXX XXX, or +61…"
            className={phoneInputClass}
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
              Could not continue
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
        continueLabel="Continue"
        continueDisabled={!isValid}
        loading={loading}
        onContinue={handleContinue}
      />
    </StepShell>
  );
}
