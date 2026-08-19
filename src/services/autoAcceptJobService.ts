import {
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { HARDCODED_JOB } from '../data/jobContractors';
import {
  AUTO_ACCEPT_BUSINESS_IDS,
  AUTO_ACCEPT_ENABLED,
} from '../config/autoAccept';
import { currentJobType } from '../config/brandDomain';
import { db } from '../firebase';
import type { TimelineOption, WizardFormData } from '../types/wizard';
import {
  fetchBusinessesByIds,
  type BusinessProfile,
} from './businessService';
import { labelsFromJobType } from './jobService';
import {
  queueJobAcceptedEmail,
  queueJobAcceptedSms,
  resolveCustomerEmailForAcceptedJob,
} from './mailService';

/**
 * Mirrors Flutter `JobMapper._parseTimeline` so acceptedJobs docs match a
 * manual Accept from the Business App.
 */
function parseTimelineForAcceptedJob(timeline: TimelineOption | ''): {
  urgency: 'urgent' | 'normal';
  timelineLabel: string;
  timeline: string;
  timelineSubtext: string;
} {
  switch (timeline) {
    case 'asap':
      return {
        urgency: 'urgent',
        timelineLabel: 'URGENT',
        timeline: 'ASAP',
        timelineSubtext: 'Within 7 days',
      };
    case 'within-2-weeks':
      return {
        urgency: 'normal',
        timelineLabel: '2 WEEKS',
        timeline: 'Within 2 weeks',
        timelineSubtext: 'Ready to book soon',
      };
    case 'in-a-month':
      return {
        urgency: 'normal',
        timelineLabel: '1 MONTH',
        timeline: 'In a month',
        timelineSubtext: 'Planning ahead',
      };
    case 'comparing':
      return {
        urgency: 'normal',
        timelineLabel: 'QUOTES',
        timeline: 'Comparing quotes',
        timelineSubtext: 'No rush',
      };
    default:
      return {
        urgency: 'normal',
        timelineLabel: 'NEW',
        timeline: 'Flexible',
        timelineSubtext: 'Timeline not set',
      };
  }
}

function formatPhoneForBusinessApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('61')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

function isPlaceholderBusinessId(id: string): boolean {
  return (
    !id ||
    /^BUSINESS_\d+_UID$/i.test(id) ||
    id.includes('[') ||
    id === 'YOUR_BUSINESS_ID'
  );
}

/** Configured non-placeholder Firestore `businesses/{id}` document IDs. */
export function getConfiguredAutoAcceptBusinessIds(): string[] {
  return AUTO_ACCEPT_BUSINESS_IDS.filter((id) => !isPlaceholderBusinessId(id));
}

/**
 * The Business App streams New Jobs from `users` and hides any id present in
 * `businesses/{businessUid}/acceptedJobs`. Doc ids MUST match the users lead:
 * - first job: `{phoneId}`
 * - additional job: `{phoneId}_{jobsDocId}`
 */
export function businessVisibleUsersDocId(
  phoneId: string,
  jobsCollectionId?: string,
): string {
  if (!jobsCollectionId) return phoneId;
  return `${phoneId}_${jobsCollectionId}`;
}

/**
 * Payload matching Flutter `JobPost.toFirestore()` used by AcceptedJobService.acceptJob.
 */
export function buildAcceptedJobFirestorePayload(params: {
  formData: WizardFormData;
  customerAuthUid: string;
  /** Same id used as the acceptedJobs document id (users lead doc id). */
  usersLeadDocId: string;
  photoUrls?: string[];
}): Record<string, unknown> {
  const { formData, customerAuthUid, usersLeadDocId, photoUrls = [] } = params;
  const location =
    formData.locationData?.displayLabel?.trim() ||
    formData.locationData?.formattedAddress?.trim() ||
    '';
  const timelineParts = parseTimelineForAcceptedJob(formData.timeline);
  const phoneId = formData.phone.replace(/\D/g, '') || formData.phone;

  return {
    title: HARDCODED_JOB.title,
    location,
    description: formData.jobDescription.trim(),
    urgency: timelineParts.urgency,
    timelineLabel: timelineParts.timelineLabel,
    fullLocation: location,
    customerName: formData.fullName.trim() || 'Customer',
    customerPhone: formatPhoneForBusinessApp(phoneId),
    customerEmail: formData.email.trim().toLowerCase() || null,
    chatId: usersLeadDocId,
    customerAuthUid,
    memberSince: String(new Date().getFullYear()),
    jobsPosted: 1,
    timeline: timelineParts.timeline,
    timelineSubtext: timelineParts.timelineSubtext,
    photoCount: photoUrls.length || formData.photos.length,
    photoUrls,
    createdAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
    autoAccepted: true,
  };
}

/**
 * Resolves business profiles for matching UI. Prefer configured auto-accept
 * IDs so every post maps to the live platform businesses.
 */
export async function resolveAutoAcceptBusinesses(
): Promise<BusinessProfile[]> {
  if (!AUTO_ACCEPT_ENABLED) {
    return [];
  }

  const configuredIds = getConfiguredAutoAcceptBusinessIds();

  if (configuredIds.length > 0) {
    const resolved = await fetchBusinessesByIds(configuredIds);
    if (resolved.length > 0) {
      return resolved;
    }
    console.warn(
      '[auto-accept] Configured business IDs were not found as profiles; acceptedJobs will still use the raw IDs.',
      configuredIds,
    );
    // Return stub profiles so callers still get matchedBusinessIds = configured IDs.
    return configuredIds.map((id) => ({
      id,
      uid: id,
      email: '',
      businessName: 'Business',
      phone: '',
    }));
  }

  console.warn(
    '[auto-accept] AUTO_ACCEPT_BUSINESS_IDS still use placeholders. Set VITE_AUTO_ACCEPT_BUSINESS_IDS to real businesses/{id} document IDs.',
  );

  return [];
}

/**
 * Business UIDs that receive acceptedJobs writes. Prefer hardcoded config IDs
 * so Accept/Reject disappears for those exact Business App accounts.
 */
function resolveAcceptedJobsTargetIds(
  matchedBusinesses: BusinessProfile[],
): string[] {
  const configured = getConfiguredAutoAcceptBusinessIds();
  if (configured.length > 0) return configured;
  return matchedBusinesses.map((b) => b.id).filter(Boolean);
}

/**
 * Writes Flutter-compatible accepted job docs so the Business App removes the
 * lead from New Jobs (Accept/Reject) and shows it under Accepted Jobs.
 *
 * Path: `businesses/{businessUid}/acceptedJobs/{usersLeadDocId}`
 * (exact same path Flutter `AcceptedJobService.acceptJob` writes)
 */
export async function writeAcceptedJobsForBusinesses(params: {
  usersLeadDocId: string;
  formData: WizardFormData;
  customerAuthUid: string;
  businesses: BusinessProfile[];
  photoUrls?: string[];
}): Promise<string | null> {
  const { usersLeadDocId, formData, customerAuthUid, businesses, photoUrls } =
    params;

  const businessIds = resolveAcceptedJobsTargetIds(businesses);
  if (businessIds.length === 0) {
    console.warn('[auto-accept] No businesses to write acceptedJobs for.');
    return null;
  }

  const payload = buildAcceptedJobFirestorePayload({
    formData,
    customerAuthUid,
    usersLeadDocId,
    photoUrls,
  });

  // Atomic multi-doc write matching Flutter's acceptJob set() per business.
  const batch = writeBatch(db);
  for (const businessId of businessIds) {
    batch.set(
      doc(db, 'businesses', businessId, 'acceptedJobs', usersLeadDocId),
      payload,
    );
  }
  await batch.commit();

  const assignedBusinessId = businessIds[0] ?? null;
  console.log('[auto-accept] Wrote acceptedJobs for businesses:', {
    usersLeadDocId,
    businessIds,
    assignedBusinessId,
  });

  return assignedBusinessId;
}

/** Patch photoUrls on acceptedJobs after async upload completes. */
export async function updateAcceptedJobsPhotos(params: {
  usersLeadDocId: string;
  businesses: BusinessProfile[];
  photoUrls: string[];
}): Promise<void> {
  const { usersLeadDocId, businesses, photoUrls } = params;
  const businessIds = resolveAcceptedJobsTargetIds(businesses);
  if (businessIds.length === 0 || photoUrls.length === 0) return;

  const batch = writeBatch(db);
  for (const businessId of businessIds) {
    batch.update(
      doc(db, 'businesses', businessId, 'acceptedJobs', usersLeadDocId),
      {
        photoUrls,
        photoCount: photoUrls.length,
      },
    );
  }
  await batch.commit();
}

/**
 * Temporary auto-accept after the business-visible users lead exists (or its
 * id is known). Writes the Firestore shape the Business App uses for Accepted
 * Jobs / New Jobs filtering and queues the customer acceptance email.
 */
export async function runTemporaryAutoAccept(params: {
  /** users/{id} document id that appears in the Business App New Jobs feed. */
  usersLeadDocId: string;
  formData: WizardFormData;
  uid: string;
  matchedBusinesses: BusinessProfile[];
  photoUrls?: string[];
  /** Firestore `jobs/{id}` when posting an additional job (email fallback). */
  jobId?: string;
}): Promise<BusinessProfile | null> {
  const { usersLeadDocId, formData, uid, matchedBusinesses, photoUrls, jobId } =
    params;

  const assignedBusinessId = await writeAcceptedJobsForBusinesses({
    usersLeadDocId,
    formData,
    customerAuthUid: uid,
    businesses: matchedBusinesses,
    photoUrls,
  });

  if (!assignedBusinessId) {
    console.warn('[auto-accept] No matched businesses — skipping auto-accept.');
    return null;
  }

  const acceptor =
    matchedBusinesses.find((b) => b.id === assignedBusinessId) ?? {
      id: assignedBusinessId,
      uid: assignedBusinessId,
      email: '',
      businessName: 'Business',
      phone: '',
    };

  try {
    const customerEmail = await resolveCustomerEmailForAcceptedJob({
      formData,
      usersLeadDocId,
      jobId,
    });

    if (!customerEmail) {
      console.warn(
        '[auto-accept] Job was auto-accepted but no customer email could be resolved.',
        { usersLeadDocId, jobId },
      );
    } else {
      await queueJobAcceptedEmail({
        to: customerEmail,
        formData,
        acceptor,
        jobTitle: labelsFromJobType(currentJobType).title,
      });
    }

    await queueJobAcceptedSms({
      formData,
      acceptor,
      usersLeadDocId,
      jobId,
      jobTitle: labelsFromJobType(currentJobType).title,
    });
  } catch (err) {
    console.error('Failed to queue job accepted notifications:', err);
    if (err instanceof Error) {
      console.error(err.message);
    }
  }

  return acceptor;
}
