import { AlertCircle, ArrowRight, Loader2, Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { AppLogo } from '../components/layout/AppLogo';
import { OrangeDotsLoader } from '../components/ui/OrangeDotsLoader';
import { OtpBoxesInput } from '../components/ui/OtpBoxesInput';
import { WizardCard } from '../components/wizard/WizardCard';
import { completeLoginVerification } from '../lib/completeLoginVerification';
import { withMinimumDelay } from '../lib/withMinimumDelay';
import { waitForCondition } from '../lib/waitForCondition';
import {
  clearRecaptchaVerifier,
  ensureRecaptchaReady,
  findUserByPhone,
  getAuthErrorMessage,
  resetRecaptchaVerifier,
  sendLoginOtp,
  verifySignupOtp,
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

const NO_ACCOUNT_MESSAGE =
  "You don't have an account yet. Please submit a quote request first.";

const inputClass =
  'w-full rounded-lg border border-border py-3 pr-4 pl-10 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30';

/** Same sequence as completeSignupVerification's private helper — not exported there. */
async function waitForVerifiedAuthUser(uid: string): Promise<void> {
  await auth.authStateReady();
  await waitForCondition(() => auth.currentUser?.uid === uid);
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error('Authentication failed. Please try again.');
  }
  await user.getIdToken();
}

function getLoginOtpVerifyErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message === NO_ACCOUNT_MESSAGE) {
    return NO_ACCOUNT_MESSAGE;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    switch (code) {
      case 'auth/invalid-verification-code':
        return 'Invalid OTP. Please check the code and try again.';
      case 'auth/code-expired':
        return 'This code has expired. Tap Resend Code for a new one.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes.';
      default:
        break;
    }
  }
  return 'Something went wrong. Please try again.';
}

export function LoginPage({ onSuccess, onNewUser, onVerifyFailed }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneNormalized, setPhoneNormalized] = useState('');
  const [lookupPending, setLookupPending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [checkingOtp, setCheckingOtp] = useState(false);
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
    setSendingCode(true);
    lookupFailedRef.current = false;
    docIdRef.current = '';
    confirmationRef.current = null;

    void (async () => {
      try {
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
    if (otp.trim().length < 6 || verifying || checkingOtp) return;

    const otpValue = otp.trim();
    setCheckingOtp(true);
    setError(null);

    void (async () => {
      let uid: string;
      try {
        await waitForCondition(() => confirmationRef.current);
        if (!confirmationRef.current) {
          throw new Error('Verification session expired. Please try again.');
        }

        uid = await verifySignupOtp(confirmationRef.current, otpValue);
      } catch (err) {
        console.error('OTP verify error:', err);
        const message = getLoginOtpVerifyErrorMessage(err);
        setCheckingOtp(false);
        setOtp('');
        setError(message);
        onVerifyFailed?.(message);
        return;
      }

      setCheckingOtp(false);
      setVerifying(true);

      try {
        await waitForVerifiedAuthUser(uid);

        const found = await findUserByPhone(phone);
        if (!found) {
          throw new Error(NO_ACCOUNT_MESSAGE);
        }

        docIdRef.current = found.docId;

        await withMinimumDelay(
          completeLoginVerification({
            confirmation: confirmationRef.current,
            otp: otpValue,
            docId: found.docId,
            phoneNormalized,
          }),
        );

        onSuccess();
      } catch (err) {
        console.error('OTP verify error:', err);
        const message = getLoginOtpVerifyErrorMessage(err);
        useDashboardStore.getState().clear();
        clearSession();
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out errors during failed verification cleanup.
        }
        setVerifying(false);
        setError(message);
        if (message === NO_ACCOUNT_MESSAGE) {
          setStep('phone');
        } else {
          onVerifyFailed?.(message);
        }
      }
    })();
  };

  const handleChangePhone = () => {
    if (verifying || checkingOtp) return;

    setStep('phone');
    setOtp('');
    setError(null);
    setSendingCode(false);
    setLookupPending(false);
    setCheckingOtp(false);
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
                  placeholder="04XX XXX XXX"
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
              Login
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
              disabled={otp.length < 6 || lookupPending || sendingCode || checkingOtp}
              className="relative mt-6 flex w-full items-center justify-center rounded-lg py-3.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-brand-muted enabled:bg-brand enabled:hover:bg-[#d96f42] enabled:active:bg-[#c9653a]"
            >
              {checkingOtp ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <>
                  Verify
                  <ArrowRight
                    className="absolute right-4 h-4 w-4"
                    strokeWidth={2}
                  />
                </>
              )}
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
