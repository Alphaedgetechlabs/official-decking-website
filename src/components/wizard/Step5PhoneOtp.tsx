import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { OrangeDotsLoader } from '../ui/OrangeDotsLoader';
import { useWizard } from '../../context/WizardContext';
import { withMinimumDelay } from '../../lib/withMinimumDelay';
import { formatPhoneDisplay } from '../../utils/phone';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { WizardCard } from './WizardCard';

interface Step5PhoneOtpProps {
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
}

export function Step5PhoneOtp({ onVerify, onResend }: Step5PhoneOtpProps) {
  const { formData, prevStep, nextStep } = useWizard();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDisplay = formatPhoneDisplay(formData.phone);
  const isValid = otp.trim().length === 6;

  const handleVerify = () => {
    if (!isValid || verifying) return;

    setVerifying(true);
    setError(null);

    void (async () => {
      try {
        await withMinimumDelay(onVerify(otp.trim()));
        nextStep();
      } catch (err) {
        console.error('Signup OTP verify error:', err);
        setVerifying(false);
        setError('Invalid OTP. Please check the code and try again.');
      }
    })();
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setOtp('');

    try {
      await onResend();
    } catch (err) {
      console.error('Signup OTP resend error:', err);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (verifying) {
    return (
      <WizardCard>
        <ProgressHeader step={5} totalSteps={6} />
        <h1 className="text-2xl font-bold leading-tight text-heading sm:text-[1.65rem]">
          Setting up your account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          We&apos;re verifying your phone and matching you with local contractors...
        </p>
        <OrangeDotsLoader className="mt-4" />
      </WizardCard>
    );
  }

  return (
    <WizardCard>
      <ProgressHeader step={5} totalSteps={6} />

      <h1 className="text-2xl font-bold leading-tight text-heading sm:text-[1.65rem]">
        Verify your phone number
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-body">
        We sent a 6-digit code to{' '}
        <strong className="font-semibold text-heading">{phoneDisplay}</strong>.
        Enter it below to create your account.
      </p>

      <div className="mt-6">
        <label
          htmlFor="signup-otp"
          className="mb-2 block text-sm font-semibold text-heading"
        >
          Verification Code
        </label>
        <input
          id="signup-otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          placeholder="000000"
          className="w-full rounded-lg border border-border px-4 py-4 text-center text-lg tracking-[0.3em] text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
            strokeWidth={2}
          />
          <p className="text-sm leading-relaxed text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 text-xs text-body">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
        Your account is secured with phone verification
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-body">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
        Didn&apos;t receive the code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? 'Resending...' : 'Resend OTP'}
        </button>
      </div>

      <NavButtons
        onBack={prevStep}
        continueLabel="Get My Free Quotes"
        continueDisabled={!isValid}
        loading={false}
        onContinue={handleVerify}
      />
    </WizardCard>
  );
}
