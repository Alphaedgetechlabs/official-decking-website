import { useRef } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Step5Matching } from "@/components/wizard/Step5Matching";
import { useWizard } from "@/context/WizardContext";
import { auth } from "@/firebase";
import { completeSignupVerification } from "@/lib/completeSignupVerification";
import { waitForCondition } from "@/lib/waitForCondition";
import type { PostedNotificationsPayload, StaggerAcceptPlan } from "@/services/jobService";
import {
  ensureRecaptchaReady,
  getAuthErrorMessage,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from "@/services/authService";
import { useDashboardStore } from "@/stores/dashboardStore";
import { clearSession } from "@/utils/session";

type MatchingReadyResult = {
  postedNotificationsPayload?: PostedNotificationsPayload | null;
  staggerAcceptPlan?: StaggerAcceptPlan | null;
};

export function QuotePostAuth({ readyPromise }: { readyPromise?: Promise<MatchingReadyResult> }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 sm:px-8">
      <Step5Matching
        onComplete={() => navigate("/app", { replace: true })}
        readyPromise={readyPromise}
      />
    </div>
  );
}

/** Map verify failures to a user-facing message (do not mask non-OTP errors). */
export function getSignupOtpVerifyErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    if (
      code === "auth/invalid-verification-code" ||
      code === "auth/code-expired" ||
      code === "auth/invalid-verification-id"
    ) {
      return "Invalid OTP. Please check the code and try again.";
    }
    if (code === "auth/network-request-failed") {
      return "Network error. Check your connection and try again.";
    }
    if (code === "permission-denied") {
      return "Unable to load matched businesses. Please try again.";
    }
    return getAuthErrorMessage(err, "Verification failed. Please try again.");
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return "Invalid OTP. Please check the code and try again.";
}

export function useSignupOtpHandlers(
  confirmationRef: React.MutableRefObject<ConfirmationResult | null>,
) {
  const { formData, matchedBusinesses, setMatchedBusinesses } = useWizard();

  const handleSendOtp = async (phoneE164: string) => {
    confirmationRef.current = null;
    const recaptcha = await ensureRecaptchaReady();
    confirmationRef.current = await sendLoginOtp(phoneE164, recaptcha);
  };

  const handleResendOtp = async () => {
    try {
      await resetRecaptchaVerifier();
      const recaptcha = await ensureRecaptchaReady();
      confirmationRef.current = await sendLoginOtp(formData.phone, recaptcha);
    } catch (err) {
      console.error("OTP resend error:", err);
      await resetRecaptchaVerifier();
      throw new Error(
        getAuthErrorMessage(err, "Failed to resend verification code. Please try again."),
      );
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    try {
      await waitForCondition(() => confirmationRef.current);
      if (!confirmationRef.current) {
        throw new Error("Verification session expired. Please try again.");
      }

      const { businesses, postedNotificationsPayload, staggerAcceptPlan } = await completeSignupVerification({
        confirmation: confirmationRef.current,
        otp,
        formData,
        matchedBusinesses,
      });
      setMatchedBusinesses(businesses);
      return { postedNotificationsPayload, staggerAcceptPlan };
    } catch (error) {
      console.error("Exact OTP Error: ", error);
      useDashboardStore.getState().clear();
      clearSession();
      // Don't await — signOut can hang on auth/network-request-failed and freeze the UI.
      void signOut(auth).catch(() => {});
      throw error;
    }
  };

  return { handleSendOtp, handleResendOtp, handleVerifyOtp };
}

export function useOtpConfirmationRef() {
  return useRef<ConfirmationResult | null>(null);
}
