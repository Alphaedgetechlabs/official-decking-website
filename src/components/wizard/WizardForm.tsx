import { useEffect, useRef } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { PhoneAlreadyRegisteredError } from '../../errors/authErrors';
import { useWizard } from '../../context/WizardContext';
import { auth } from '../../firebase';
import { cachePrefetchedBusinesses } from '../../lib/optimisticSignup';
import { completeSignupVerification } from '../../lib/completeSignupVerification';
import { waitForCondition } from '../../lib/waitForCondition';
import {
  ensureRecaptchaReady,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from '../../services/authService';
import { fetchRandomBusinesses } from '../../services/businessService';
import { isPhoneRegistered } from '../../services/userService';
import { useDashboardStore } from '../../stores/dashboardStore';
import { clearSession } from '../../utils/session';
import { sanitizePhone } from '../../utils/phone';
import { Step1Location } from './Step1Location';
import { Step2Timeline } from './Step2Timeline';
import { Step3JobDescription } from './Step3JobDescription';
import { Step4ContactDetails } from './Step4ContactDetails';
import { Step5PhoneOtp } from './Step5PhoneOtp';
import { Step5Matching } from './Step5Matching';

interface WizardFormProps {
  onComplete: () => void;
}

export function WizardForm({ onComplete }: WizardFormProps) {
  const { step, formData, matchedBusinesses, setMatchedBusinesses } = useWizard();
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const otpSendFailedRef = useRef(false);

  useEffect(() => {
    if (step !== 4) return;
    void fetchRandomBusinesses(3).then((businesses) => {
      if (businesses.length === 0) return;
      setMatchedBusinesses(businesses);
      cachePrefetchedBusinesses(businesses);
    });
  }, [step, setMatchedBusinesses]);

  const handleSendSignupOtp = async (phoneE164: string) => {
    const phoneId = sanitizePhone(phoneE164);
    otpSendFailedRef.current = false;
    confirmationRef.current = null;

    if (await isPhoneRegistered(phoneId)) {
      throw new PhoneAlreadyRegisteredError();
    }

    const recaptcha = await ensureRecaptchaReady();
    confirmationRef.current = await sendLoginOtp(phoneE164, recaptcha);
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

      const { businesses } = await completeSignupVerification({
        confirmation: confirmationRef.current,
        otp,
        formData,
        matchedBusinesses,
      });
      setMatchedBusinesses(businesses);
    } catch (err) {
      console.error('Signup OTP verify error:', err);
      useDashboardStore.getState().clear();
      clearSession();
      try {
        await signOut(auth);
      } catch {
        // Ignore sign-out errors during failed verification cleanup.
      }
      throw err;
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-5 py-10 sm:px-8">
      {step === 1 && <Step1Location />}
      {step === 2 && <Step2Timeline />}
      {step === 3 && <Step3JobDescription />}
      {step === 4 && <Step4ContactDetails onSendOtp={handleSendSignupOtp} />}
      {step === 5 && (
        <Step5PhoneOtp
          onVerify={handleVerifySignupOtp}
          onResend={handleResendSignupOtp}
        />
      )}
      {step === 6 && <Step5Matching onComplete={onComplete} />}
    </div>
  );
}
