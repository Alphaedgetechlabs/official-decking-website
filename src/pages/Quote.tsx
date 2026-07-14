import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import LocationStep from "@/components/steps/LocationStep";
import TimelineStep from "@/components/steps/TimelineStep";
import DescriptionStep from "@/components/steps/DescriptionStep";
import ContactStep from "@/components/steps/ContactStep";
import { QuotePostAuth, useOtpConfirmationRef } from "@/components/quote/QuotePostAuth";
import { WizardProvider, useWizard } from "@/context/WizardContext";
import { PhoneAlreadyRegisteredError } from "@/errors/authErrors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { buildWizardFormData } from "@/lib/quoteFormMapper";
import { cachePrefetchedBusinesses } from "@/lib/optimisticSignup";
import { ensureInstantBusinesses } from "@/lib/dashboardBusinesses";
import { Suburb } from "@/data/formData";
import type { StoredLocation } from "@/types/location";
import {
  ensureRecaptchaReady,
  getAuthErrorMessage,
  resetRecaptchaVerifier,
  sendLoginOtp,
} from "@/services/authService";
import { fetchRandomBusinesses } from "@/services/businessService";
import { isPhoneRegistered } from "@/services/userService";
import { formatPhoneForAuth, sanitizePhone } from "@/utils/phone";

type Step = "location" | "timeline" | "description" | "contact" | "otp" | "matching";

const TRADE = "Decking";

function QuoteFlow({ onBackToContactRef }: { onBackToContactRef: React.MutableRefObject<() => void> }) {
  useDocumentTitle("Get Your Free Decking Quote — QuoteMyDeck");
  const navigate = useNavigate();
  const { updateFormData, setStep: setWizardStep, setMatchedBusinesses } = useWizard();
  const confirmationRef = useOtpConfirmationRef();

  const [step, setStep] = useState<Step>("location");
  const [, setSuburb] = useState<Suburb | null>(null);
  const [locationData, setLocationData] = useState<StoredLocation | null>(null);
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);

  onBackToContactRef.current = () => setStep("contact");

  const handleContactSubmit = (data: { name: string; email: string; phone: string }) => {
    if (!locationData) return;

    setContactError(null);

    const phoneE164 = formatPhoneForAuth(data.phone);
    const phoneId = sanitizePhone(phoneE164);

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

    setWizardStep(5);
    setStep("otp");
    ensureInstantBusinesses();

    void fetchRandomBusinesses(3).then((businesses) => {
      if (businesses.length) {
        setMatchedBusinesses(businesses);
        cachePrefetchedBusinesses(businesses);
      }
    });

    void (async () => {
      try {
        if (await isPhoneRegistered(phoneId)) {
          throw new PhoneAlreadyRegisteredError();
        }

        const recaptcha = await ensureRecaptchaReady();
        confirmationRef.current = await sendLoginOtp(phoneE164, recaptcha);
      } catch (err) {
        console.error("OTP send error:", err);
        if (err instanceof PhoneAlreadyRegisteredError) {
          const message = "This phone number is already registered. Redirecting to login...";
          setContactError(message);
          toast.error(message);
          setStep("contact");
          setWizardStep(4);
          setTimeout(() => navigate("/login"), 1500);
          return;
        }
        await resetRecaptchaVerifier();
        const message = getAuthErrorMessage(
          err,
          "Failed to send verification code. Please try again.",
        );
        setContactError(message);
        toast.error(message);
        setStep("contact");
        setWizardStep(4);
      }
    })();
  };

  switch (step) {
    case "location":
      return (
        <LocationStep
          trade={TRADE}
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
          trade={TRADE}
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
        <ContactStep
          onNext={handleContactSubmit}
          onBack={() => setStep("description")}
          submitting={false}
          error={contactError}
          onClearError={() => setContactError(null)}
        />
      );
    case "otp":
      return (
        <OtpStepBridge
          confirmationRef={confirmationRef}
          onVerified={() => setStep("matching")}
        />
      );
    case "matching":
      return <QuotePostAuth phase="matching" confirmationRef={confirmationRef} />;
    default:
      return null;
  }
}

function OtpStepBridge({
  confirmationRef,
  onVerified,
}: {
  confirmationRef: ReturnType<typeof useOtpConfirmationRef>;
  onVerified: () => void;
}) {
  const { step: wizardStep } = useWizard();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (wizardStep >= 6 && !syncedRef.current) {
      syncedRef.current = true;
      onVerified();
    }
  }, [wizardStep, onVerified]);

  if (wizardStep >= 6) {
    return <QuotePostAuth phase="matching" confirmationRef={confirmationRef} />;
  }

  return <QuotePostAuth phase="otp" confirmationRef={confirmationRef} />;
}

const Quote = () => {
  const backToContactRef = useRef<() => void>(() => {});

  return (
    <WizardProvider onBackFromOtp={() => backToContactRef.current()}>
      <QuoteFlow onBackToContactRef={backToContactRef} />
    </WizardProvider>
  );
};

export default Quote;
