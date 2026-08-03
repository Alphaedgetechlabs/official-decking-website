import { useState } from "react";
import { toast } from "sonner";
import LocationStep from "@/components/steps/LocationStep";
import TimelineStep from "@/components/steps/TimelineStep";
import DescriptionStep from "@/components/steps/DescriptionStep";
import ContactStep from "@/components/steps/ContactStep";
import {
  QuotePostAuth,
  getSignupOtpVerifyErrorMessage,
  useOtpConfirmationRef,
  useSignupOtpHandlers,
} from "@/components/quote/QuotePostAuth";
import { VerifyMobileModal } from "@/components/wizard/VerifyMobileModal";
import { WizardProvider, useWizard } from "@/context/WizardContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { buildWizardFormData } from "@/lib/quoteFormMapper";
import {
  parseQuoteQueryInit,
  type QuoteFormStep,
} from "@/lib/quoteQueryInit";
import { cachePrefetchedBusinesses } from "@/lib/optimisticSignup";
import { ensureInstantBusinesses } from "@/lib/dashboardBusinesses";
import { withMinimumDelay } from "@/lib/withMinimumDelay";
import { Suburb } from "@/data/formData";
import type { StoredLocation } from "@/types/location";
import {
  getAuthErrorMessage,
  resetRecaptchaVerifier,
} from "@/services/authService";
import { fetchRandomBusinesses } from "@/services/businessService";
import { brandName, tradeLabelTitle } from "@/config/brandDomain";
import { formatPhoneForAuth } from "@/utils/phone";
import type { PostedNotificationsPayload, StaggerAcceptPlan } from "@/services/jobService";

/** Cosmetic path while matching runs — shallow so React Router keeps /quote mounted. */
const MATCHING_URL = "/formsubmitted";

type MatchingReadyResult = {
  postedNotificationsPayload?: PostedNotificationsPayload | null;
  staggerAcceptPlan?: StaggerAcceptPlan | null;
};

function QuoteFlow() {
  useDocumentTitle(`Get Your Free ${tradeLabelTitle} Quote — ${brandName}`);
  const { updateFormData, setStep: setWizardStep, setMatchedBusinesses } = useWizard();
  const confirmationRef = useOtpConfirmationRef();
  const { handleSendOtp, handleResendOtp, handleVerifyOtp } =
    useSignupOtpHandlers(confirmationRef);

  const [boot] = useState(() =>
    parseQuoteQueryInit(new URLSearchParams(window.location.search)),
  );
  const [step, setStep] = useState<QuoteFormStep>(boot.step);
  const [, setSuburb] = useState<Suburb | null>(boot.suburb);
  const [locationData, setLocationData] = useState<StoredLocation | null>(
    boot.locationData,
  );
  const [timeline, setTimeline] = useState(boot.timeline);
  const [description, setDescription] = useState(boot.description);
  const [photos, setPhotos] = useState<File[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [matchingPromise, setMatchingPromise] = useState<Promise<MatchingReadyResult> | undefined>();

  const handleContactSubmit = (data: {
    name: string;
    email: string;
    phone: string;
  }) => {
    if (!locationData) return;

    setContactError(null);
    setOtpError(null);

    const phoneE164 = formatPhoneForAuth(data.phone);
    setPhoneDisplay(data.phone);

    updateFormData(
      buildWizardFormData({
        locationData,
        timelineLabel: timeline,
        jobDescription: description,
        photos,
        fullName: data.name,
        email: data.email,
        phone: phoneE164,
      }),
    );

    setOtpModalOpen(true);
    ensureInstantBusinesses();

    // Best-effort only — businesses require auth; real match runs after OTP.
    void fetchRandomBusinesses(3)
      .then((businesses) => {
        if (businesses.length) {
          setMatchedBusinesses(businesses);
          cachePrefetchedBusinesses(businesses);
        }
      })
      .catch((err) => {
        console.warn('Pre-auth business prefetch skipped:', err);
      });

    void handleSendOtp(phoneE164).catch(async (err) => {
      console.error("OTP send error:", err);
      await resetRecaptchaVerifier();
      const message = getAuthErrorMessage(
        err,
        "Failed to send verification code. Please try again.",
      );
      setOtpModalOpen(false);
      setContactError(message);
      toast.error(message);
    });
  };

  const handleVerify = (otp: string) => {
    setOtpError(null);
    setOtpModalOpen(false);

    const promise = withMinimumDelay(handleVerifyOtp(otp));
    setMatchingPromise(promise);
    setWizardStep(5);
    setStep("matching");

    // Hide long /quote?... query string without triggering a route remount.
    const previousUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, "", MATCHING_URL);

    void promise.catch((err) => {
      console.error("Exact OTP Error: ", err);
      window.history.replaceState(window.history.state, "", previousUrl);
      setMatchingPromise(undefined);
      setWizardStep(4);
      setStep("contact");
      const message = getSignupOtpVerifyErrorMessage(err);
      setOtpError(message);
      setOtpModalOpen(true);
      toast.error(message);
    });
  };

  const handleResend = async () => {
    setOtpError(null);
    try {
      await handleResendOtp();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to resend OTP. Please try again.";
      setOtpError(message);
      throw err;
    }
  };

  switch (step) {
    case "location":
      return (
        <LocationStep
          trade={tradeLabelTitle}
          onNext={(s, loc) => {
            setSuburb(s);
            setLocationData(loc);
            setStep("timeline");
          }}
        />
      );
    case "timeline":
      return (
        <TimelineStep
          onNext={(t) => {
            setTimeline(t);
            setStep("description");
          }}
          onBack={() => setStep("location")}
        />
      );
    case "description":
      return (
        <DescriptionStep
          trade={tradeLabelTitle}
          onNext={(d, files) => {
            setDescription(d);
            setPhotos(files);
            setStep("contact");
          }}
          onBack={() => setStep("timeline")}
        />
      );
    case "contact":
      return (
        <>
          <ContactStep
            onNext={handleContactSubmit}
            onBack={() => setStep("description")}
            error={contactError}
            onClearError={() => setContactError(null)}
          />
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
    case "matching":
      return <QuotePostAuth readyPromise={matchingPromise} />;
    default:
      return null;
  }
}

const Quote = () => {
  return (
    <WizardProvider>
      <QuoteFlow />
    </WizardProvider>
  );
};

export default Quote;
