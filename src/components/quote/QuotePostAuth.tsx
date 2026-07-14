import { useRef } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Step5PhoneOtp } from "@/components/wizard/Step5PhoneOtp";
import { Step5Matching } from "@/components/wizard/Step5Matching";
import { useWizard } from "@/context/WizardContext";
import { auth } from "@/firebase";
import { completeSignupVerification } from "@/lib/completeSignupVerification";
import { waitForCondition } from "@/lib/waitForCondition";
import {
  ensureRecaptchaReady,
  getAuthErrorMessage,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from "@/services/authService";
import { useDashboardStore } from "@/stores/dashboardStore";
import { clearSession } from "@/utils/session";

interface QuotePostAuthProps {
  phase: "otp" | "matching";
  confirmationRef: React.MutableRefObject<ConfirmationResult | null>;
}

export function QuotePostAuth({ phase, confirmationRef }: QuotePostAuthProps) {
  const navigate = useNavigate();
  const { formData, matchedBusinesses, setMatchedBusinesses } = useWizard();

  const handleResendSignupOtp = async () => {
    try {
      await resetRecaptchaVerifier();
      const recaptcha = await ensureRecaptchaReady();
      confirmationRef.current = await sendLoginOtp(formData.phone, recaptcha);
    } catch (err) {
      console.error("OTP resend error:", err);
      await resetRecaptchaVerifier();
      const message = getAuthErrorMessage(err, "Failed to resend verification code. Please try again.");
      toast.error(message);
      throw err;
    }
  };

  const handleVerifySignupOtp = async (otp: string) => {
    await waitForCondition(() => confirmationRef.current);
    const { businesses } = await completeSignupVerification({
      confirmation: confirmationRef.current!,
      otp,
      formData,
      matchedBusinesses,
    });
    setMatchedBusinesses(businesses);
  };

  if (phase === "matching") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 sm:px-8">
        <Step5Matching onComplete={() => navigate("/app")} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 sm:px-8">
      <Step5PhoneOtp
        onVerify={handleVerifySignupOtp}
        onResend={handleResendSignupOtp}
      />
    </div>
  );
}

export function useOtpConfirmationRef() {
  return useRef<ConfirmationResult | null>(null);
}
