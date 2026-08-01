import { AlertCircle, ArrowRight, Loader2, Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { AppLogo } from '../components/layout/AppLogo';
import { OrangeDotsLoader } from '../components/ui/OrangeDotsLoader';
import { OtpBoxesInput } from '../components/ui/OtpBoxesInput';
import { WizardCard } from '../components/wizard/WizardCard';
import { completeLoginVerification } from '../lib/completeLoginVerification';
import { ensureInstantBusinesses, prefetchDashboardForUser } from '../lib/dashboardBusinesses';
import { withMinimumDelay } from '../lib/withMinimumDelay';
import { waitForCondition } from '../lib/waitForCondition';
import {
  clearRecaptchaVerifier,
  ensureRecaptchaReady,
  findUserByPhone,
  getAuthErrorMessage,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from '../services/authService';
import { useDashboardStore } from '../stores/dashboardStore';
import { auth } from '../firebase';
import {
  formatPhoneForAuth,
  isValidPhoneInput,
  sanitizePhone,
} from '../utils/phone';
import { clearSession } from '../utils/session';

interface LoginPageProps {
  onSuccess: () => void;
  onNewUser: () => void;
  onVerifyFailed?: (message: string) => void;
}

type LoginStep = 'phone' | 'otp';

const inputClass =
  'w-full rounded-lg border border-border py-3 pr-4 pl-10 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30';

export function LoginPage({ onSuccess, onNewUser, onVerifyFailed }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneNormalized, setPhoneNormalized] = useState('');
  const [lookupPending, setLookupPending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const docIdRef = useRef('');
  const lookupFailedRef = useRef(false);

  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  const handleSendOtp = () => {
    if (!isValidPhoneInput(phone)) return;

    const phoneForAuth = formatPhoneForAuth(phone);
    const phoneId = sanitizePhone(phoneForAuth);

    setError(null);
    setPhone(phoneForAuth);
    setPhoneNormalized(phoneId);
    setStep('otp');
    setLookupPending(true);
    setSendingCode(true);
    lookupFailedRef.current = false;
    docIdRef.current = '';
    confirmationRef.current = null;

    void (async () => {
      try {
        const found = await findUserByPhone(phoneForAuth);
        if (!found) {
          lookupFailedRef.current = true;
          setStep('phone');
          setError("User doesn't exist. Please submit a quote request first.");
          return;
        }

        docIdRef.current = found.docId;
        useDashboardStore.getState().setUser(found.data);
        ensureInstantBusinesses();
        void prefetchDashboardForUser(found.data);

        const recaptcha = await ensureRecaptchaReady();
        confirmationRef.current = await sendLoginOtp(phoneForAuth, recaptcha);
      } catch (err) {
        console.error('OTP send error:', err);
        await resetRecaptchaVerifier();
        setStep('phone');
        confirmationRef.current = null;
        setError(getAuthErrorMessage(err, 'Failed to send OTP. Please try again.'));
      } finally {
        setLookupPending(false);
        setSendingCode(false);
      }
    })();
  };

  const handleVerifyOtp = () => {
    if (otp.trim().length < 6 || verifying) return;

    const otpValue = otp.trim();
    setVerifying(true);
    setError(null);

    void (async () => {
      try {
        if (lookupFailedRef.current) {
          throw new Error('Account lookup failed.');
        }

        await waitForCondition(() => docIdRef.current || lookupFailedRef.current);
        if (lookupFailedRef.current || !docIdRef.current) {
          throw new Error('Account lookup failed.');
        }

        await waitForCondition(() => confirmationRef.current);

        await withMinimumDelay(
          completeLoginVerification({
            confirmation: confirmationRef.current!,
            otp: otpValue,
            docId: docIdRef.current,
            phoneNormalized,
          }),
        );

        onSuccess();
      } catch (err) {
        console.error('OTP verify error:', err);
        const message = 'Invalid OTP. Please check the code and try again.';
        useDashboardStore.getState().clear();
        clearSession();
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out errors during failed verification cleanup.
        }
        setVerifying(false);
        setError(message);
        onVerifyFailed?.(message);
      }
    })();
  };

  const handleChangePhone = () => {
    if (verifying) return;

    setStep('phone');
    setOtp('');
    setError(null);
    setSendingCode(false);
    setLookupPending(false);
    setVerifying(false);
    lookupFailedRef.current = false;
    docIdRef.current = '';
    confirmationRef.current = null;
    void resetRecaptchaVerifier();
  };

  const otpHint = lookupPending
    ? 'Checking your account...'
    : sendingCode
      ? 'Sending code...'
      : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-4 py-8 sm:px-6">
      <div className="mb-6">
        <AppLogo />
      </div>

      <WizardCard compact>
        {verifying ? (
          <>
            <h1 className="text-2xl font-bold leading-tight text-heading">
              Signing you in
            </h1>
            <p className="mt-2 text-sm text-body">
              Loading your profile and matched contractors...
            </p>
            <OrangeDotsLoader className="mt-2" />
          </>
        ) : step === 'phone' ? (
          <>
            <h1 className="text-2xl font-bold leading-tight text-heading">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              Enter your phone number to log in to your account.
            </p>

            <div className="mt-6">
              <label
                htmlFor="login-phone"
                className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
              >
                <Phone className="h-4 w-4" strokeWidth={2} />
                Phone Number
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400"
                  strokeWidth={2}
                />
                <input
                  id="login-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  placeholder="03XX XXXXXXX, +92 3XX…, 04XX XXX XXX, or +61…"
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-tight text-heading">
              Enter OTP
            </h1>
            <p className="mt-2 text-sm text-body">
              Enter the 6-digit code sent to{' '}
              <span className="font-medium text-heading">{phone}</span>.
            </p>

            {otpHint && (
              <div className="mt-3 flex items-center gap-2 text-sm text-body">
                <Loader2 className="h-4 w-4 animate-spin text-brand" strokeWidth={2} />
                {otpHint}
              </div>
            )}

            <div className="mt-6">
              <label
                htmlFor="login-otp"
                className="mb-2 block text-sm font-semibold text-heading"
              >
                Verification Code
              </label>
              <OtpBoxesInput
                id="login-otp"
                value={otp}
                autoFocus
                onChange={(value) => {
                  setOtp(value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
              />
            </div>
          </>
        )}

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

        {!verifying && step === 'phone' ? (
          <>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={!isValidPhoneInput(phone)}
              className="relative mt-6 flex w-full items-center justify-center rounded-lg py-3.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-brand-muted enabled:bg-brand enabled:hover:bg-[#d96f42] enabled:active:bg-[#c9653a]"
            >
              Send OTP
              <ArrowRight
                className="absolute right-4 h-4 w-4"
                strokeWidth={2}
              />
            </button>

            <div className="mt-6 border-t border-border pt-6 text-center text-sm text-body">
              New here?{' '}
              <button
                type="button"
                onClick={onNewUser}
                className="font-semibold text-brand hover:underline"
              >
                Get a free quote
              </button>
            </div>
          </>
        ) : !verifying && step === 'otp' ? (
          <>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={otp.length < 6 || lookupPending || sendingCode}
              className="relative mt-6 flex w-full items-center justify-center rounded-lg py-3.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-brand-muted enabled:bg-brand enabled:hover:bg-[#d96f42] enabled:active:bg-[#c9653a]"
            >
              Verify
              <ArrowRight
                className="absolute right-4 h-4 w-4"
                strokeWidth={2}
              />
            </button>

            <button
              type="button"
              onClick={handleChangePhone}
              className="mt-4 w-full text-center text-sm font-medium text-body hover:text-heading"
            >
              Change phone number
            </button>
          </>
        ) : null}
      </WizardCard>
    </div>
  );
}
