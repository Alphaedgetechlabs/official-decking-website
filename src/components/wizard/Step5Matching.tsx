import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Shield, Star, User, Zap } from 'lucide-react';
import { OrangeDotsLoader } from '../ui/OrangeDotsLoader';
import { useWizard } from '../../context/WizardContext';
import { resolveSignupBusinesses } from '../../lib/optimisticSignup';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { BusinessProfile } from '../../services/businessService';
import { getBusinessDisplayMeta } from '../../utils/businessDisplay';
import { StepShell } from './StepShell';

const FEATURES = [
  { icon: User, label: 'Verified\nProfessionals' },
  { icon: Shield, label: 'Licensed &\nInsured' },
  { icon: Star, label: 'Reviewed by\nLocals' },
  { icon: Zap, label: 'Fast\nResponse' },
];

const CONTRACTOR_STAGGER_MS = 250;
const SUCCESS_HOLD_MS = 1200;
const FEATURES_HOLD_MS = 800;

interface Step5MatchingProps {
  onComplete: () => void;
  /** When provided, the loader stays until this promise resolves. */
  readyPromise?: Promise<void>;
}

function toMatchingContractor(business: BusinessProfile) {
  const { rating, reviews } = getBusinessDisplayMeta(business.businessName);

  return {
    id: business.id,
    name: business.businessName,
    rating,
    reviews,
    message: `Great! ${business.businessName} is available for your job.`,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Step5Matching({ onComplete, readyPromise }: Step5MatchingProps) {
  const { variant, matchedBusinesses } = useWizard();
  const cachedBusinesses = useDashboardStore((s) => s.businesses);

  const effectiveBusinesses = useMemo(
    () => resolveSignupBusinesses(matchedBusinesses.length > 0 ? matchedBusinesses : cachedBusinesses),
    [matchedBusinesses, cachedBusinesses],
  );

  const contractors = useMemo(
    () => effectiveBusinesses.map(toMatchingContractor),
    [effectiveBusinesses],
  );

  const contractorsKey = useMemo(
    () => effectiveBusinesses.map((business) => business.id).join(','),
    [effectiveBusinesses],
  );

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isWaiting, setIsWaiting] = useState(Boolean(readyPromise));
  const [visibleCount, setVisibleCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (readyPromise) {
        try {
          await readyPromise;
        } catch {
          return;
        }
        if (cancelled) return;
        setIsWaiting(false);
      }

      if (contractors.length === 0) return;

      setVisibleCount(0);
      setShowSuccess(false);
      setShowFeatures(false);

      for (let i = 0; i < contractors.length; i++) {
        if (cancelled) return;
        await delay(CONTRACTOR_STAGGER_MS);
        if (cancelled) return;
        setVisibleCount(i + 1);
      }

      if (cancelled) return;
      await delay(400);
      if (cancelled) return;
      setShowSuccess(true);

      await delay(SUCCESS_HOLD_MS);
      if (cancelled) return;

      if (variant !== 'addJob') {
        setShowFeatures(true);
        await delay(FEATURES_HOLD_MS);
      }

      if (!cancelled) {
        onCompleteRef.current();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contractorsKey, readyPromise, contractors.length, variant]);

  const showLoader = isWaiting || (contractors.length === 0 && !readyPromise);

  return (
    <StepShell className={variant === 'addJob' ? '' : 'min-h-[720px] py-14 sm:py-16'}>
      <div className="text-center">
        <h1
          className={`font-bold leading-snug text-heading ${
            variant === 'addJob' ? 'text-lg' : 'text-xl sm:text-2xl'
          }`}
        >
          We&apos;re finding the best contractors near you...
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-body">
          Local verified pros are checking your job details right now.
        </p>

        {showLoader && <OrangeDotsLoader className="mt-10" />}
      </div>

      {!showLoader && (
        <>
          <div className="mt-8 space-y-4">
            {contractors.slice(0, visibleCount).map((contractor, i) => (
              <div
                key={contractor.id}
                className="animate-[fadeInUp_0.5s_ease-out_forwards] rounded-xl border border-border p-5 opacity-0"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light">
                    <Shield className="h-4 w-4 text-brand" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-heading">
                        {contractor.name}
                      </p>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
                        <Check
                          className="h-3.5 w-3.5 text-white"
                          strokeWidth={3}
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <Star
                        className="h-3.5 w-3.5 text-brand"
                        fill="#e87a4d"
                        strokeWidth={0}
                      />
                      <span className="font-semibold text-heading">
                        {contractor.rating}
                      </span>
                      <span className="text-body">
                        • {contractor.reviews} reviews
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs font-bold text-green-600">
                        Accepted!
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-body">
                      {contractor.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showSuccess && (
            <div className="mt-5 animate-[fadeInUp_0.5s_ease-out_forwards] rounded-xl bg-green-50 p-5 opacity-0">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500">
                  <Check className="h-5 w-5 text-white" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">
                    Your quotes are being prepared now!
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-green-700">
                    We&apos;ve matched you with {contractors.length || 3} top-rated
                    contractors in your area. You&apos;ll receive your quotes shortly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showFeatures && variant !== 'addJob' && (
            <div className="mt-6 animate-[fadeInUp_0.5s_ease-out_forwards] opacity-0">
              <div className="grid grid-cols-4 gap-2">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light">
                      <Icon className="h-4 w-4 text-brand" strokeWidth={2} />
                    </div>
                    <span className="whitespace-pre-line text-[10px] font-semibold leading-tight text-heading sm:text-xs">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm font-bold text-heading">
                  Your quotes will arrive in the next 3–7 minutes.
                </p>
                <p className="mt-1 text-xs text-body">
                  Keep an eye on your phone.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </StepShell>
  );
}
