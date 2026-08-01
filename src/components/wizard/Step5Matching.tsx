import { useEffect, useRef, useState } from 'react';
import { Check, Shield, Star, User, Zap } from 'lucide-react';
import { OrangeDotsLoader } from '../ui/OrangeDotsLoader';
import { Skeleton } from '../ui/skeleton';
import { STAGGERED_ACCEPT_ENABLED } from '../../config/autoAccept';
import { tradeLabel, tradeLabelTitle } from '../../config/brandDomain';
import { useWizard } from '../../context/WizardContext';
import { auth } from '../../firebase';
import { useJobAcceptedBusinesses } from '../../hooks/useJobAcceptedBusinesses';
import {
  labelsFromJobType,
  queuePostedNotifications,
  writeAcceptedJobForBusiness,
  subscribeUserJobs,
  type PostedNotificationsPayload,
  type StaggerAcceptPlan,
  type UserJobListItem,
} from '../../services/jobService';
import { currentJobType } from '../../config/brandDomain';
import type { BusinessProfile } from '../../services/businessService';
import { queueJobAcceptedEmail, queueJobAcceptedSms } from '../../services/mailService';
import { useDashboardStore } from '../../stores/dashboardStore';
import { getFirstName, type UserDocument } from '../../types/user';
import { getBusinessDisplayMeta } from '../../utils/businessDisplay';
import {
  TARGET_MATCH_SLOTS,
  type BusinessMatchStatus,
} from '../../utils/businessMatchStatus';
import { sanitizePhone } from '../../utils/phone';
import { StepShell } from './StepShell';

const FEATURES = [
  { icon: User, label: 'Verified\nProfessionals' },
  { icon: Shield, label: 'Licensed &\nInsured' },
  { icon: Star, label: 'Reviewed by\nLocals' },
  { icon: Zap, label: 'Fast\nResponse' },
];

/** Hold after all 3 accepts revealed (“Congratulations!”) before routing home. */
const FULL_SUCCESS_HOLD_MS = 3000;
/** Partial exit (idle timeout, <3 accepts) navigates home immediately. */
const PARTIAL_EXIT_HOLD_MS = 0;
const FEATURES_HOLD_MS = 500;
/** Wait after Job Posted before revealing the 1st accept. */
const JOB_POSTED_TO_FIRST_ACCEPT_MS = 3000;
/** Delay between 1st→2nd and 2nd→3rd staggered reveals. */
const STAGGER_MS = 2000;
/** Partial-accept idle timeout after last activity. */
const ACTIVITY_TIMEOUT_MS = 5000;

export type { BusinessMatchStatus };

type MatchingPhase = 'searching' | 'jobPosted' | 'accepting' | 'complete';
/** How we leave the screen — Congrats UI only for `full`. */
type ExitMode = 'none' | 'partial' | 'full';

interface MatchingContractor {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  message: string;
}

interface Step5MatchingProps {
  onComplete: () => void;
  /** Resolves when the job post + verification path has finished successfully. */
  readyPromise?: Promise<{
    postedNotificationsPayload?: PostedNotificationsPayload | null;
    staggerAcceptPlan?: StaggerAcceptPlan | null;
  }>;
}

function toMatchingContractor(business: BusinessProfile): MatchingContractor {
  const { rating, reviews } = getBusinessDisplayMeta(business.businessName);

  return {
    id: business.id,
    name: business.businessName,
    rating,
    reviews,
    message: `${business.businessName} is available for your job.`,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUserId(user: UserDocument | null, formPhone: string): string {
  const fromUser =
    (typeof user?.phoneNormalized === 'string' && user.phoneNormalized.trim()) ||
    (typeof user?.phone === 'string' && user.phone.trim()) ||
    '';
  const raw = fromUser || formPhone.trim();
  if (!raw) return '';
  try {
    return sanitizePhone(raw);
  } catch {
    return raw;
  }
}

function ordinalAcceptLabel(count: number): string {
  if (count === 1) return 'first';
  if (count === 2) return 'second';
  return 'third';
}

function pickNewestRealJob(jobs: UserJobListItem[]): UserJobListItem | null {
  const real = jobs
    .filter((job) => job.id && job.id !== 'signup-job')
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return real[0] ?? null;
}

function AcceptedBusinessCard({
  contractor,
  index,
}: {
  contractor: MatchingContractor;
  index: number;
}) {
  return (
    <div
      className="animate-[fadeInUp_0.5s_ease-out_forwards] rounded-xl border border-border bg-white p-5 opacity-0"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light">
          <Shield className="h-4 w-4 text-brand" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-heading">{contractor.name}</p>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
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
            <span className="text-body">• {contractor.reviews} reviews</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-600 ring-1 ring-inset ring-green-200">
              Accepted!
            </span>
          </div>
          <p className="mt-1 text-xs text-body">{contractor.message}</p>
        </div>
      </div>
    </div>
  );
}

function PendingBusinessSkeleton({ index }: { index: number }) {
  return (
    <div
      className="animate-[fadeInUp_0.45s_ease-out_forwards] rounded-xl border border-border/70 bg-gray-50/80 p-5 opacity-0"
      style={{ animationDelay: `${index * 0.08}s` }}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-36 bg-gray-200" />
            <Skeleton className="h-6 w-6 shrink-0 rounded-full bg-gray-200" />
          </div>
          <Skeleton className="h-3 w-28 bg-gray-200" />
          <Skeleton className="h-3 w-20 bg-gray-200" />
          <Skeleton className="h-3 w-full max-w-[220px] bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function Step5Matching({ onComplete, readyPromise }: Step5MatchingProps) {
  const { variant, formData, matchedBusinesses, staggerAcceptPlan: wizardStaggerAcceptPlan } = useWizard();
  const user = useDashboardStore((s) => s.user);
  const cachedJobs = useDashboardStore((s) => s.jobs);

  const firstName = getFirstName(
    formData.fullName?.trim() || user?.fullName || '',
  );

  const [jobPosted, setJobPosted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [phase, setPhase] = useState<MatchingPhase>('searching');
  const [exitMode, setExitMode] = useState<ExitMode>('none');
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const hasRoutedRef = useRef(false);
  const revealedRef = useRef(0);
  const activityAtRef = useRef(Date.now());
  const mountAtRef = useRef(Date.now());
  const staggerQueueRef = useRef(Promise.resolve());
  const backendCountRef = useRef(0);
  const completingRef = useRef(false);
  const queuedPostedNotificationsJobIdsRef = useRef<Set<string>>(new Set());
  const readyPromiseStaggerPlanRef = useRef<StaggerAcceptPlan | null>(null);
  const startedStaggerJobIdRef = useRef<string | null>(null);
  const staggerRunIdRef = useRef(0);
  const activeStaggerRunIdRef = useRef<number | null>(null);
  const baselineJobIdsRef = useRef<Set<string> | null>(null);
  if (baselineJobIdsRef.current === null) {
    baselineJobIdsRef.current = new Set(
      cachedJobs.map((job) => job.id).filter(Boolean),
    );
  }

  // Unmount-only cancel via per-run token. Remount bumps the token so stale chains die.
  useEffect(() => {
    staggerRunIdRef.current += 1;
    activeStaggerRunIdRef.current = staggerRunIdRef.current;
    startedStaggerJobIdRef.current = null;
    console.log('[STAGGER] MOUNT RESET', Date.now());
    return () => {
      activeStaggerRunIdRef.current = null;
      console.log('[STAGGER] UNMOUNT CANCEL', Date.now());
    };
  }, []);

  const bumpActivity = () => {
    activityAtRef.current = Date.now();
  };

  const { businesses: acceptedFromBackend } = useJobAcceptedBusinesses(
    jobId ?? '',
  );

  const queuePostedNotificationsOnce = (payload: PostedNotificationsPayload) => {
    const uniqueJobId = payload.options.jobId;
    if (!uniqueJobId) return;
    if (queuedPostedNotificationsJobIdsRef.current.has(uniqueJobId)) return;
    queuedPostedNotificationsJobIdsRef.current.add(uniqueJobId);

    void queuePostedNotifications(payload).catch((err) => {
      console.error(`Failed to queue posted notifications for ${uniqueJobId}:`, err);
    });
  };

  const resolveActiveStaggerPlan = (): StaggerAcceptPlan | null => {
    return readyPromiseStaggerPlanRef.current ?? wizardStaggerAcceptPlan;
  };

  // State 2 signal: readyPromise resolved (signup / quote) ⇒ job is posted.
  useEffect(() => {
    if (!readyPromise) return;

    let cancelled = false;
    void readyPromise
      .then((result) => {
        if (cancelled) return;
        console.log('[STAGGER] jobPosted=true at', Date.now());
        setJobPosted(true);
        readyPromiseStaggerPlanRef.current = result?.staggerAcceptPlan ?? null;
        if (STAGGERED_ACCEPT_ENABLED && result?.postedNotificationsPayload) {
          queuePostedNotificationsOnce(result.postedNotificationsPayload);
        }
        setPhase((prev) => (prev === 'searching' ? 'jobPosted' : prev));
        bumpActivity();
      })
      .catch(() => {
        // Parent handles OTP / post failure — stay on State 1.
      });

    return () => {
      cancelled = true;
    };
  }, [readyPromise]);

  // Discover the real jobId (and State 2 for add-job) via existing jobs listener.
  useEffect(() => {
    const uid = auth.currentUser?.uid ?? user?.uid ?? '';
    const userId = resolveUserId(user, formData.phone);
    if (!uid || !userId) return;

    // Signup path: wait until the post promise succeeds before binding a job.
    if (readyPromise && !jobPosted) return;

    const unsub = subscribeUserJobs(uid, userId, (jobs) => {
      const baseline = baselineJobIdsRef.current ?? new Set<string>();
      // Prefer a job that did not exist when this screen mounted (the one just posted).
      // Also accept a baseline id whose createdAt is at/after mount — parent
      // listeners can race the new job into the store before Step5 mounts.
      const candidates = jobs.filter((job) => {
        if (!job.id || job.id === 'signup-job') return false;
        if (!baseline.has(job.id)) return true;
        return job.createdAtMs >= mountAtRef.current - 2000;
      });
      const posted =
        pickNewestRealJob(candidates) ??
        (baseline.size === 0 ? pickNewestRealJob(jobs) : null);

      if (!posted) return;

      setJobId((prev) => prev ?? posted.id);

      if (!readyPromise) {
        console.log('[STAGGER] jobPosted=true at', Date.now());
        setJobPosted(true);
        if (STAGGERED_ACCEPT_ENABLED) {
          queuePostedNotificationsOnce({
            formData,
            matchedBusinesses,
            options: {
              jobId: posted.id,
              jobTitle: labelsFromJobType(currentJobType).title,
              customerLabel: 'A customer',
              matchedBusinessIds: matchedBusinesses.map((business) => business.id),
            },
          });
        }
        setPhase((prev) => (prev === 'searching' ? 'jobPosted' : prev));
        bumpActivity();
      }
    });

    return unsub;
  }, [readyPromise, jobPosted, user, formData.phone]);

  // Staggered reveals — false flag branch (existing acceptedFromBackend-driven behavior).
  useEffect(() => {
    if (STAGGERED_ACCEPT_ENABLED) return;
    console.log('[STAGGER] effect run — jobPosted:', jobPosted, 'backendCount:', Math.min(acceptedFromBackend.length, TARGET_MATCH_SLOTS), 'revealed:', revealedRef.current, 'at', Date.now());
    const backendCount = Math.min(
      acceptedFromBackend.length,
      TARGET_MATCH_SLOTS,
    );
    backendCountRef.current = backendCount;

    // Wait for job post before showing any accept UI.
    if (!jobPosted || completingRef.current) return;
    if (backendCount <= revealedRef.current) return;

    bumpActivity();

    staggerQueueRef.current = staggerQueueRef.current.then(async () => {
      while (revealedRef.current < backendCountRef.current) {
        const next = revealedRef.current + 1;
        console.log('[STAGGER] waiting', next === 1 ? JOB_POSTED_TO_FIRST_ACCEPT_MS : STAGGER_MS, 'ms for card', next, 'at', Date.now());
        await delay(
          next === 1 ? JOB_POSTED_TO_FIRST_ACCEPT_MS : STAGGER_MS,
        );
        if (completingRef.current) return;
        if (next > backendCountRef.current) return;

        console.log('[STAGGER] reveal', next, 'at', Date.now());
        revealedRef.current = next;
        if (next === 1) {
          setPhase('accepting');
        }
        setRevealedCount(next);
        bumpActivity();

        if (next >= TARGET_MATCH_SLOTS) {
          return;
        }
      }
    });
  }, [acceptedFromBackend, jobPosted]);

  // Staggered reveals — true flag branch (driver is staggerCandidates, not acceptedFromBackend listener).
  useEffect(() => {
    if (!STAGGERED_ACCEPT_ENABLED) return;

    const activePlan = resolveActiveStaggerPlan();
    const stagedCount = Math.min(
      activePlan?.staggerCandidates.length ?? 0,
      TARGET_MATCH_SLOTS,
    );
    backendCountRef.current = stagedCount;

    console.log('[STAGGER] EFFECT RUN', {
      jobId: activePlan?.jobId ?? null,
      jobPosted,
      stagedCount,
      revealed: revealedRef.current,
      startedJobId: startedStaggerJobIdRef.current,
      myRunId: staggerRunIdRef.current,
      activeRunId: activeStaggerRunIdRef.current,
      at: Date.now(),
    });

    if (!jobPosted || completingRef.current) return;
    if (!activePlan) return;
    if (stagedCount <= revealedRef.current) return;
    if (startedStaggerJobIdRef.current === activePlan.jobId) return;
    startedStaggerJobIdRef.current = activePlan.jobId;

    bumpActivity();

    const myRunId = staggerRunIdRef.current;

    console.log('[STAGGER] CHAIN SCHEDULED', {
      jobId: activePlan.jobId,
      myRunId,
      at: Date.now(),
    });

    staggerQueueRef.current = staggerQueueRef.current.then(async () => {
      while (revealedRef.current < backendCountRef.current) {
        const next = revealedRef.current + 1;
        await delay(
          next === 1 ? JOB_POSTED_TO_FIRST_ACCEPT_MS : STAGGER_MS,
        );
        if (activeStaggerRunIdRef.current !== myRunId) return;
        if (completingRef.current) return;
        if (next > backendCountRef.current) return;

        const candidate = activePlan.staggerCandidates[next - 1];
        if (!candidate) return;

        console.log('[STAGGER] WRITE', {
          next,
          id: candidate.id,
          businessName: candidate.businessName,
          myRunId,
          activeRunId: activeStaggerRunIdRef.current,
          at: Date.now(),
        });

        try {
          await writeAcceptedJobForBusiness({
            plan: activePlan,
            business: candidate,
          });
        } catch (err) {
          console.error(
            `[stagger] Failed accepted_jobs write for ${activePlan.jobId} business ${candidate.id}:`,
            err,
          );
        }
        if (activeStaggerRunIdRef.current !== myRunId) return;

        console.log('[STAGGER] EMAIL', {
          next,
          id: candidate.id,
          businessName: candidate.businessName,
          myRunId,
          activeRunId: activeStaggerRunIdRef.current,
          at: Date.now(),
        });

        void queueJobAcceptedEmail({
          to: activePlan.formData.email,
          formData: activePlan.formData,
          acceptor: candidate,
          jobTitle: labelsFromJobType(currentJobType).title,
          position: next as 1 | 2 | 3,
          acceptedSoFar: activePlan.staggerCandidates.slice(0, next).map((b) => ({
            businessName: b.businessName,
            rating: b.rating,
            reviewCount: b.reviewCount,
          })),
        }).catch((err) => {
          console.error(
            `[stagger] Failed to queue accepted email for ${activePlan.jobId} business ${candidate.id}:`,
            err,
          );
        });

        void queueJobAcceptedSms({
          formData: activePlan.formData,
          acceptor: candidate,
          usersLeadDocId: activePlan.usersLeadDocIdForAcceptedSms,
          jobId: activePlan.jobId,
          jobTitle: labelsFromJobType(currentJobType).title,
        }).catch((err) => {
          console.error(
            `[stagger] Failed to queue accepted SMS for ${activePlan.jobId} business ${candidate.id}:`,
            err,
          );
        });

        revealedRef.current = next;
        if (next === 1) {
          setPhase('accepting');
        }
        setRevealedCount(next);
        bumpActivity();

        if (next >= TARGET_MATCH_SLOTS) {
          return;
        }
      }
    });
  }, [jobPosted, wizardStaggerAcceptPlan]);

  const beginFullSuccess = () => {
    if (completingRef.current || hasRoutedRef.current) return;
    completingRef.current = true;
    setPhase('complete');
    setExitMode('full');
    setShowCompleteBanner(true);
  };

  /** Partial: no Congratulations — brief quotes note then home. */
  const beginPartialExit = () => {
    if (completingRef.current || hasRoutedRef.current) return;
    completingRef.current = true;
    setExitMode('partial');
    setShowCompleteBanner(true);
  };

  // Full success only when all 3 slots have been revealed.
  useEffect(() => {
    if (revealedCount >= TARGET_MATCH_SLOTS) {
      beginFullSuccess();
    }
  }, [revealedCount]);

  // Idle timeout while short of 3 — leave without Congratulations.
  useEffect(() => {
    if (!jobPosted || exitMode !== 'none') return;

    const timer = window.setInterval(() => {
      if (completingRef.current) return;
      if (revealedRef.current >= TARGET_MATCH_SLOTS) return;
      if (Date.now() - activityAtRef.current < ACTIVITY_TIMEOUT_MS) return;
      beginPartialExit();
    }, 250);

    return () => window.clearInterval(timer);
  }, [jobPosted, exitMode]);

  // Exit → home. Features / Congrats path only for full (all 3 accepted).
  useEffect(() => {
    if (exitMode === 'none') return;

    let cancelled = false;

    void (async () => {
      await delay(exitMode === 'full' ? FULL_SUCCESS_HOLD_MS : PARTIAL_EXIT_HOLD_MS);
      if (cancelled || hasRoutedRef.current) return;

      if (exitMode === 'full' && variant !== 'addJob') {
        setShowFeatures(true);
        await delay(FEATURES_HOLD_MS);
        if (cancelled || hasRoutedRef.current) return;
      }

      hasRoutedRef.current = true;
      onCompleteRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [exitMode, variant]);

  // Never show accept cards until the job is posted.
  const visibleContractors = jobPosted
    ? acceptedFromBackend.slice(0, revealedCount).map(toMatchingContractor)
    : [];
  const skeletonCount = Math.max(0, TARGET_MATCH_SLOTS - visibleContractors.length);
  const isFullSuccess = exitMode === 'full';

  // Orange top banner — hidden until job is posted. "Congratulations!" only for all 3.
  const orangeBannerText = (() => {
    if (!jobPosted) return null;
    if (isFullSuccess) return 'Congratulations!';
    if (phase === 'accepting' || revealedCount > 0) return 'Job Post Accepted';
    return `Hi ${firstName}, your ${tradeLabelTitle} Job has been posted`;
  })();

  const headline = (() => {
    if (isFullSuccess) return "It's easy to Get 3 quotes now";
    if (phase === 'accepting' && revealedCount > 0) {
      return `Congratulations ${firstName}, ${ordinalAcceptLabel(revealedCount)} contractor to accept your job post`;
    }
    return `We're finding the best ${tradeLabel} contractors near you...`;
  })();

  const footerPrimary = (() => {
    if (isFullSuccess) {
      return 'Your quotes could arrive in the next 3–7 minutes.';
    }
    if (phase === 'accepting') {
      return revealedCount >= 2
        ? 'Talk to the contractors as soon as you can so you can get your quotes in time.'
        : 'Talk to your first contractor to give you a quote as soon as possible.';
    }
    return `Don't worry ${firstName} we're working hard to get you quotes as soon as we can.`;
  })();

  const bannerTitle = showCompleteBanner
    ? 'Your quotes are being prepared now!'
    : phase === 'accepting'
      ? revealedCount >= 2
        ? "Don't worry one more to go and we're working even harder."
        : "Don't worry we're working even harder to find you more contractors."
      : null;

  const bannerSubtitle =
    showCompleteBanner && isFullSuccess
      ? `We've matched you with ${TARGET_MATCH_SLOTS} top-rated ${tradeLabel} contractors in your area. You'll receive your quotes shortly.`
      : showCompleteBanner
        ? 'You can message your matched contractors from Home.'
        : null;

  return (
    <StepShell className={variant === 'addJob' ? '' : 'min-h-[720px] py-14 sm:py-16'}>
      {orangeBannerText && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white">
          <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
          <span>{orangeBannerText}</span>
        </div>
      )}

      <div className="text-center">
        <h1
          className={`font-bold leading-snug text-heading ${
            variant === 'addJob' ? 'text-lg' : 'text-xl sm:text-2xl'
          }`}
        >
          {headline}
        </h1>

        {!showFeatures && <OrangeDotsLoader className="mt-6" />}
      </div>

      <div className="mt-8 space-y-4">
        {visibleContractors.map((contractor, i) => (
          <AcceptedBusinessCard
            key={contractor.id}
            contractor={contractor}
            index={i}
          />
        ))}

        {Array.from({ length: skeletonCount }, (_, i) => (
          <PendingBusinessSkeleton
            key={`pending-slot-${i}`}
            index={visibleContractors.length + i}
          />
        ))}
      </div>

      {bannerTitle && (
        <div className="mt-5 animate-[fadeInUp_0.5s_ease-out_forwards] rounded-xl bg-green-50 p-5 opacity-0">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500">
              <Check className="h-5 w-5 text-white" strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">{bannerTitle}</p>
              {bannerSubtitle && (
                <p className="mt-1 text-xs leading-relaxed text-green-700">
                  {bannerSubtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!showFeatures && (
        <div className="mt-4 text-center">
          <p className="text-xs text-body">{footerPrimary}</p>
          <p className="mt-1 text-xs text-body">Keep an eye on your phone.</p>
        </div>
      )}

      {showFeatures && variant !== 'addJob' && isFullSuccess && (
        <div className="mt-6 animate-[fadeInUp_0.5s_ease-out_forwards] opacity-0">
          <div className="grid grid-cols-4 gap-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center">
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
              Your quotes could arrive in the next 3–7 minutes.
            </p>
            <p className="mt-1 text-xs text-body">Keep an eye on your phone.</p>
          </div>
        </div>
      )}
    </StepShell>
  );
}
