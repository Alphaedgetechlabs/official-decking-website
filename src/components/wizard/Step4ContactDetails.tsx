import { AlertCircle, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tradeLabel } from '../../config/brandDomain';
import { useWizard } from '../../context/WizardContext';
import {
  getAuthErrorMessage,
  resetRecaptchaVerifier,
} from '../../services/authService';
import { formatPhoneForAuth, isValidPhoneInput } from '../../utils/phone';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';
import { VerifyMobileModal } from './VerifyMobileModal';

interface Step4ContactDetailsProps {
  onSendOtp: (phoneE164: string) => Promise<void>;
  onVerificationStart: (otp: string) => void;
  onResendOtp: () => Promise<void>;
  otpRetry?: { error: string } | null;
  onOtpRetryHandled?: () => void;
}

export function Step4ContactDetails({
  onSendOtp,
  onVerificationStart,
  onResendOtp,
  otpRetry,
  onOtpRetryHandled,
}: Step4ContactDetailsProps) {
  const { formData, updateFormData, prevStep } = useWizard();
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Raw typed phone for OTP modal UI only — auth still uses E.164. */
  const [phoneDisplay, setPhoneDisplay] = useState('');

  const isValid =
    formData.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    isValidPhoneInput(formData.phone);

  useEffect(() => {
    if (!otpRetry) return;
    setOtpError(otpRetry.error);
    setOtpModalOpen(true);
    onOtpRetryHandled?.();
  }, [otpRetry, onOtpRetryHandled]);

  const handleContinue = () => {
    if (!isValid) return;

    setSubmitError(null);
    setOtpError(null);
    setPhoneDisplay(formData.phone);
    setOtpModalOpen(true);

    const phoneE164 = formatPhoneForAuth(formData.phone);
    updateFormData({ phone: phoneE164 });

    void onSendOtp(phoneE164).catch(async (error) => {
      await resetRecaptchaVerifier();
      setOtpModalOpen(false);
      setSubmitError(
        getAuthErrorMessage(
          error,
          'Failed to send verification code. Please try again.',
        ),
      );
      console.error('OTP send error:', error);
    });
  };

  const handleVerify = (otp: string) => {
    setOtpModalOpen(false);
    setOtpError(null);
    onVerificationStart(otp);
  };

  const handleResend = async () => {
    try {
      await onResendOtp();
    } catch (err) {
      console.error('Signup OTP resend error:', err);
      setOtpError('Failed to resend OTP. Please try again.');
      throw err;
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border px-4 py-4 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30';

  const phoneInputClass = `${inputClass} ${
    submitError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''
  }`;

  return (
    <>
      <StepShell>
        <ProgressHeader step={4} />

        <h1 className="text-2xl font-bold leading-tight text-heading sm:text-[1.65rem]">
          Almost done! Your quotes are just minutes away.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Enter your details so your {tradeLabel} pros can send accurate pricing.
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
              disabled={otpModalOpen}
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
              disabled={otpModalOpen}
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
              placeholder="04XX XXX XXX"
              className={phoneInputClass}
              disabled={otpModalOpen}
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
          continueDisabled={!isValid || otpModalOpen}
          loading={false}
          onContinue={handleContinue}
        />
      </StepShell>

      <VerifyMobileModal
        open={otpModalOpen}
        phoneDisplay={phoneDisplay}
        onVerify={handleVerify}
        onResend={handleResend}
        error={otpError}
        onClearError={() => setOtpError(null)}
      />
    </>
  );
}
