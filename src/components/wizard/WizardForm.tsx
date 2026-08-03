import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { useWizard } from '../../context/WizardContext';
import { auth } from '../../firebase';
import { cachePrefetchedBusinesses } from '../../lib/optimisticSignup';
import { completeSignupVerification } from '../../lib/completeSignupVerification';
import { withMinimumDelay } from '../../lib/withMinimumDelay';
import { waitForCondition } from '../../lib/waitForCondition';
import type { PostedNotificationsPayload, StaggerAcceptPlan } from '../../services/jobService';
import {
  ensureRecaptchaReady,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from '../../services/authService';
import { fetchRandomBusinesses } from '../../services/businessService';
import { useDashboardStore } from '../../stores/dashboardStore';
import { clearSession } from '../../utils/session';
import { Step1Location } from './Step1Location';
import { Step2Timeline } from './Step2Timeline';
import { Step3JobDescription } from './Step3JobDescription';
import { Step4ContactDetails } from './Step4ContactDetails';
import { Step5Matching } from './Step5Matching';

interface WizardFormProps {
  onComplete: () => void;
}

type MatchingReadyResult = {
  postedNotificationsPayload?: PostedNotificationsPayload | null;
  staggerAcceptPlan?: StaggerAcceptPlan | null;
};

export function WizardForm({ onComplete }: WizardFormProps) {
  const { step, formData, matchedBusinesses, setMatchedBusinesses, setStep } = useWizard();
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const otpSendFailedRef = useRef(false);
  const [matchingPromise, setMatchingPromise] = useState<Promise<MatchingReadyResult> | undefined>();
  const [otpRetry, setOtpRetry] = useState<{ error: string } | null>(null);

  useEffect(() => {
    if (step !== 4) return;
    // Best-effort only — businesses require auth; real match runs after OTP.
    void fetchRandomBusinesses(3)
      .then((businesses) => {
        if (businesses.length === 0) return;
        setMatchedBusinesses(businesses);
        cachePrefetchedBusinesses(businesses);
      })
      .catch((err) => {
        console.warn('Pre-auth business prefetch skipped:', err);
      });
  }, [step, setMatchedBusinesses]);

  const handleSendSignupOtp = async (phoneE164: string) => {
    otpSendFailedRef.current = false;
    confirmationRef.current = null;

    try {
      const recaptcha = await ensureRecaptchaReady();
      confirmationRef.current = await sendLoginOtp(phoneE164, recaptcha);
    } catch (err) {
      otpSendFailedRef.current = true;
      throw err;
    }
  };

  const handleResendSignupOtp = async () => {
    await resetRecaptchaVerifier();
    await handleSendSignupOtp(formData.phone);
  };

  const handleVerifySignupOtp = async (otp: string) => {
    try {
      await waitForCondition(
        () => confirmationRef.current || otpSendFailedRef.current,
      );
      if (otpSendFailedRef.current || !confirmationRef.current) {
        throw new Error('Verification session expired. Please go back and try again.');
      }

      const { businesses, postedNotificationsPayload, staggerAcceptPlan } = await completeSignupVerification({
        confirmation: confirmationRef.current,
        otp,
        formData,
        matchedBusinesses,
      });
      setMatchedBusinesses(businesses);
      return { postedNotificationsPayload, staggerAcceptPlan };
    } catch (err) {
      console.error('Signup OTP verify error:', err);
      useDashboardStore.getState().clear();
      clearSession();
      // Don't await — signOut can hang on auth/network-request-failed and freeze the UI.
      void signOut(auth).catch(() => {});
      throw err;
    }
  };

  const handleVerificationStart = (otp: string) => {
    const promise = withMinimumDelay(handleVerifySignupOtp(otp));
    setMatchingPromise(promise);
    setStep(5);

    void promise.catch(() => {
      setMatchingPromise(undefined);
      setStep(4);
      setOtpRetry({
        error: 'Invalid OTP. Please check the code and try again.',
      });
    });
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-5 py-10 sm:px-8">
      {step === 1 && <Step1Location />}
      {step === 2 && <Step2Timeline />}
      {step === 3 && <Step3JobDescription />}
      {step === 4 && (
        <Step4ContactDetails
          onSendOtp={handleSendSignupOtp}
          onVerificationStart={handleVerificationStart}
          onResendOtp={handleResendSignupOtp}
          otpRetry={otpRetry}
          onOtpRetryHandled={() => setOtpRetry(null)}
        />
      )}
      {step === 5 && (
        <Step5Matching onComplete={onComplete} readyPromise={matchingPromise} />
      )}
    </div>
  );
}
