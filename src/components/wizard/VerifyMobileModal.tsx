import { AlertCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { OtpBoxesInput } from '../ui/OtpBoxesInput';

interface VerifyMobileModalProps {
  open: boolean;
  phoneDisplay: string;
  onVerify: (otp: string) => void;
  onResend: () => Promise<void>;
  error?: string | null;
  onClearError?: () => void;
}

/** Visual-only matching screen under the OTP blur — no fetch / step logic. */
function MatchingWaitingBackdrop() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-surface px-5 py-10 sm:px-8"
      aria-hidden
    >
      <div className="flex min-h-[720px] w-full max-w-[520px] flex-col rounded-xl bg-white px-7 py-14 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:px-9 sm:py-16">
        {/* Content pinned to top so dots sit above the centered OTP dialog */}
        <div className="text-center">
          <h1 className="text-xl font-bold leading-snug text-heading sm:text-2xl">
            We&apos;re finding the best contractors near you...
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-body">
            Local verified pros are checking your job details right now.
          </p>
          <div
            className="mt-6 flex items-end justify-center gap-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="loading-dot-bounce h-3 w-3 rounded-full bg-brand" />
            <span className="loading-dot-bounce loading-dot-bounce-2 h-3 w-3 rounded-full bg-brand" />
            <span className="loading-dot-bounce loading-dot-bounce-3 h-3 w-3 rounded-full bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function VerifyMobileModal({
  open,
  phoneDisplay,
  onVerify,
  onResend,
  error,
  onClearError,
}: VerifyMobileModalProps) {
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);

  if (!open) return null;

  const isValid = otp.trim().length === 6;

  const handleVerify = () => {
    if (!isValid) return;
    onVerify(otp.trim());
  };

  const handleResend = async () => {
    setResending(true);
    setOtp('');
    onClearError?.();

    try {
      await onResend();
    } finally {
      setResending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <MatchingWaitingBackdrop />
      {/* Light dim only — matching loader must stay readable behind OTP */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="verify-mobile-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8"
      >
        <h2
          id="verify-mobile-title"
          className="text-center text-xl font-bold text-heading sm:text-2xl"
        >
          Verify Your Mobile
        </h2>
        <p className="mt-2 text-center text-sm text-body">
          We&apos;ve sent a 6-digit code to{' '}
          <strong className="font-semibold text-heading">{phoneDisplay}</strong>.
        </p>

        <div className="mt-6">
          <OtpBoxesInput
            id="verify-mobile-otp"
            value={otp}
            autoFocus
            onChange={(value) => {
              setOtp(value.replace(/\D/g, '').slice(0, 6));
              onClearError?.();
            }}
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

        <button
          type="button"
          onClick={handleVerify}
          disabled={!isValid}
          className="relative mt-6 flex w-full items-center justify-center rounded-xl bg-brand py-4 text-sm font-semibold text-white transition-colors hover:bg-[#d96f42] active:bg-[#c9653a] disabled:cursor-not-allowed disabled:bg-brand-muted"
        >
          Verify &amp; Continue
          <ArrowRight className="absolute right-5 h-4 w-4" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-4 w-full text-center text-sm font-medium text-body hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? 'Resending…' : 'Resend Code'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
