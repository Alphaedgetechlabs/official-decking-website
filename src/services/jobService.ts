import {
  collection,
  doc,
  GeoPoint,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { STAGGERED_ACCEPT_ENABLED } from '../config/autoAccept';
import { currentJobType } from '../config/brandDomain';
import { db, storage } from '../firebase';
import type { StoredLocation } from '../types/location';
import type { UploadedFile, WizardFormData } from '../types/wizard';
import {
  businessProvidesJobType,
  isAcceptedBusiness,
  TARGET_MATCH_SLOTS,
  type JobType,
} from '../utils/businessMatchStatus';
import { filterRealBusinesses } from '../lib/optimisticSignup';
import {
  fetchRandomBusinesses,
  resolveMatchedBusinessesForJob,
  type BusinessProfile,
} from './businessService';
import { queueJobAcceptedEmail, queueJobAcceptedSms, queueJobPostedCustomerEmail, queueJobPostedEmails, queueJobPostedSms } from './mailService';

const JOBS_COLLECTION = 'jobs';
const USERS_COLLECTION = 'users';
const INCOMING_JOBS_SUBCOLLECTION = 'incoming_jobs';
const ACCEPTED_JOBS_SUBCOLLECTION = 'accepted_jobs';

export interface PostedNotificationsPayload {
  formData: WizardFormData;
  matchedBusinesses: BusinessProfile[];
  options: {
    jobId: string;
    jobTitle: string;
    customerLabel: string;
    matchedBusinessIds: string[];
  };
}

export interface StaggerAcceptPlan {
  jobId: string;
  uid: string;
  userId: string;
  formData: WizardFormData;
  jobType: JobType;
  matchedBusinessIds: string[];
  staggerCandidates: BusinessProfile[];
  usersLeadDocIdForAcceptedSms: string;
  /** Same photoUrls createJob passes into routeJobToMatchedBusinesses. */
  photoUrls: string[];
}

/** e.g. VIC → VI-12345 */
function generateJobId(state: string): string {
  const letters = (state.trim().slice(0, 2) || 'JO').toUpperCase();
  const digits = Math.floor(10_000 + Math.random() * 90_000);
  return `${letters}-${digits}`;
}

function resolveBusinessUid(business: BusinessProfile): string {
  return business.uid?.trim() || business.id;
}

function buildJobLocationData(locationData: StoredLocation) {
  const { latitude, longitude } = locationData;

  return {
    placeId: locationData.placeId,
    name: locationData.name,
    formattedAddress: locationData.formattedAddress,
    displayLabel: locationData.displayLabel,
    suburb: locationData.suburb,
    state: locationData.state,
    stateFullName: locationData.stateFullName,
    postcode: locationData.postcode,
    country: locationData.country,
    countryName: locationData.countryName,
    latitude,
    longitude,
    geohash: geohashForLocation([latitude, longitude]),
    geopoint: new GeoPoint(latitude, longitude),
    placeTypes: locationData.placeTypes,
  };
}

function buildBusinessSubcollectionJobPayload(params: {
  jobId: string;
  formData: WizardFormData;
  uid: string;
  userId: string;
  matchedBusinessIds: string[];
  businessId: string;
  photoUrls: string[];
  status: 'open' | 'accepted';
  jobType: JobType;
}): Record<string, unknown> {
  const locationData = params.formData.locationData!;
  const { title, category } = labelsFromJobType(params.jobType);

  return {
    jobId: params.jobId,
    businessId: params.businessId,
    userId: params.userId,
    uid: params.uid,
    type: 'job' as const,
    title,
    category,
    status: params.status,
    matchedBusinessIds: params.matchedBusinessIds,
    location: locationData.displayLabel,
    locationData: buildJobLocationData(locationData),
    timeline: params.formData.timeline,
    jobDescription: params.formData.jobDescription.trim(),
    photoUrls: params.photoUrls,
    photoCount: params.photoUrls.length || params.formData.photos.length,
    fullName: params.formData.fullName.trim(),
    email: (params.formData.email ?? '').trim().toLowerCase(),
    phone: params.userId,
    jobType: params.jobType,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Fan-out a global job to each matched business's incoming_jobs subcollection.
 * When isAutoAcceptEnabled is true, also writes to accepted_jobs.
 */
interface RouteJobToMatchedBusinessesResult {
  staggerCandidates: BusinessProfile[];
  eligibleBusinessIds: string[];
}

function buildPostedNotificationsPayload(params: {
  formData: WizardFormData;
  matchedBusinesses: BusinessProfile[];
  jobId: string;
  customerLabel: string;
}): PostedNotificationsPayload {
  const { formData, matchedBusinesses, jobId, customerLabel } = params;
  return {
    formData,
    matchedBusinesses,
    options: {
      jobId,
      jobTitle: labelsFromJobType(currentJobType).title,
      customerLabel,
      matchedBusinessIds: matchedBusinesses.map((business) => business.id),
    },
  };
}

export async function queuePostedNotifications(
  payload: PostedNotificationsPayload,
): Promise<void> {
  const { formData, matchedBusinesses, options } = payload;
  await Promise.all([
    queueJobPostedEmails(formData, matchedBusinesses, options),
    queueJobPostedSms(formData, matchedBusinesses, options),
    queueJobPostedCustomerEmail({
      to: formData.email,
      formData,
    }).catch((err) => {
      console.error(
        `Failed to queue customer job-posted email for ${options.jobId}:`,
        err,
      );
    }),
  ]);
}

export async function writeAcceptedJobForBusiness(params: {
  plan: StaggerAcceptPlan;
  business: BusinessProfile;
}): Promise<void> {
  const { plan, business } = params;
  const businessUid = resolveBusinessUid(business);
  const incomingPayload = buildBusinessSubcollectionJobPayload({
    jobId: plan.jobId,
    formData: plan.formData,
    uid: plan.uid,
    userId: plan.userId,
    matchedBusinessIds: plan.matchedBusinessIds,
    businessId: business.id,
    photoUrls: plan.photoUrls,
    status: 'open',
    jobType: plan.jobType,
  });

  await setDoc(
    doc(
      db,
      'businesses',
      businessUid,
      ACCEPTED_JOBS_SUBCOLLECTION,
      plan.jobId,
    ),
    {
      ...incomingPayload,
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      autoAccepted: true,
    },
  );
}

async function routeJobToMatchedBusinesses(params: {
  jobId: string;
  formData: WizardFormData;
  uid: string;
  userId: string;
  businesses: BusinessProfile[];
  photoUrls?: string[];
  jobType: JobType;
}): Promise<RouteJobToMatchedBusinessesResult> {
  const {
    jobId,
    formData,
    uid,
    userId,
    businesses,
    photoUrls = [],
    jobType,
  } = params;

  // Only write incoming_jobs for businesses that serve this jobType.
  const eligibleBusinesses = businesses.filter((business) =>
    businessProvidesJobType(business, jobType),
  );
  const eligibleIds = eligibleBusinesses.map((b) => b.id);

  if (eligibleBusinesses.length === 0) {
    console.warn(
      `[job-route] No businesses with matching services_provided for job ${jobId} (${jobType}).`,
    );
    return { staggerCandidates: [], eligibleBusinessIds: [] };
  }

  const staggerCandidates = eligibleBusinesses
    .filter((business) => business.isAutoAcceptEnabled === true)
    .slice(0, TARGET_MATCH_SLOTS);
  const eligibleBusinessIds = eligibleBusinesses.map((business) => business.id);

  await Promise.all(
    eligibleBusinesses.map(async (business) => {
      const businessUid = resolveBusinessUid(business);

      try {
        const incomingPayload = buildBusinessSubcollectionJobPayload({
          jobId,
          formData,
          uid,
          userId,
          matchedBusinessIds: eligibleIds,
          businessId: business.id,
          photoUrls,
          status: 'open',
          jobType,
        });

        const batch = writeBatch(db);
        batch.set(
          doc(
            db,
            'businesses',
            businessUid,
            INCOMING_JOBS_SUBCOLLECTION,
            jobId,
          ),
          incomingPayload,
        );

        if (
          business.isAutoAcceptEnabled === true &&
          !STAGGERED_ACCEPT_ENABLED
        ) {
          batch.set(
            doc(
              db,
              'businesses',
              businessUid,
              ACCEPTED_JOBS_SUBCOLLECTION,
              jobId,
            ),
            {
              ...incomingPayload,
              status: 'accepted',
              acceptedAt: serverTimestamp(),
              autoAccepted: true,
            },
          );
        }

        await batch.commit();
      } catch (err) {
        console.error(
          `[job-route] Failed to route job ${jobId} to business ${businessUid}:`,
          err,
        );
      }
    }),
  );

  return { staggerCandidates, eligibleBusinessIds };
}

async function updateRoutedJobPhotos(params: {
  jobId: string;
  businesses: BusinessProfile[];
  photoUrls: string[];
}): Promise<void> {
  const { jobId, businesses, photoUrls } = params;
  if (photoUrls.length === 0 || businesses.length === 0) return;

  await Promise.all(
    businesses.map(async (business) => {
      const businessUid = resolveBusinessUid(business);
      const photoPatch = {
        photoUrls,
        photoCount: photoUrls.length,
        updatedAt: serverTimestamp(),
      };

      try {
        const batch = writeBatch(db);
        batch.update(
          doc(
            db,
            'businesses',
            businessUid,
            INCOMING_JOBS_SUBCOLLECTION,
            jobId,
          ),
          photoPatch,
        );

        if (business.isAutoAcceptEnabled === true) {
          batch.update(
            doc(
              db,
              'businesses',
              businessUid,
              ACCEPTED_JOBS_SUBCOLLECTION,
              jobId,
            ),
            photoPatch,
          );
        }

        await batch.commit();
      } catch (err) {
        console.error(
          `[job-route] Failed to update photos for job ${jobId} on business ${businessUid}:`,
          err,
        );
      }
    }),
  );
}

export interface CreateJobResult {
  jobId: string;
  matchedBusinesses: BusinessProfile[];
  staggerCandidates: BusinessProfile[];
  staggerEligibleBusinessIds: string[];
  photoUrls: string[];
}

/**
 * Creates a global jobs/{jobId} document and routes it to matched businesses.
 */
export async function createJob(
  formData: WizardFormData,
  uid: string,
  userId: string,
  options?: {
    fullName?: string;
    email?: string;
    photoUrls?: string[];
    prefetchedBusinesses?: BusinessProfile[];
  },
): Promise<CreateJobResult> {
  if (!uid.trim()) {
    throw new Error('A verified Firebase Auth uid is required.');
  }

  if (!formData.locationData) {
    throw new Error('A validated Australian location is required.');
  }

  const locationData = formData.locationData;
  const fullName = (options?.fullName ?? formData.fullName).trim();
  const email = (options?.email ?? formData.email ?? '').trim().toLowerCase();
  const photoUrls = options?.photoUrls ?? [];
  // Ignore placeholder/pre-auth prefetch — those are display-only and often empty.
  const realPrefetched = filterRealBusinesses(options?.prefetchedBusinesses ?? []);
  let nearbyBusinesses =
    realPrefetched.length > 0
      ? realPrefetched
      : await resolveMatchedBusinessesForJob(locationData);
  if (nearbyBusinesses.length === 0) {
    nearbyBusinesses = await fetchRandomBusinesses(3);
  }
  const dynamicJobType = currentJobType;
  const { title, category } = labelsFromJobType(dynamicJobType);
  const byJobType = nearbyBusinesses.filter((business) =>
    businessProvidesJobType(business, dynamicJobType),
  );
  // services_provided is often unset — don't drop every match for that.
  const matchedBusinesses =
    byJobType.length > 0 ? byJobType : nearbyBusinesses;
  const matchedBusinessIds = matchedBusinesses.map((business) => business.id);
  const jobId = generateJobId(locationData.state);

  try {
    await setDoc(doc(db, JOBS_COLLECTION, jobId), {
      jobId,
      userId,
      uid,
      type: 'job' as const,
      title,
      category,
      status: 'open' as const,
      matchedBusinessIds,
      location: locationData.displayLabel,
      locationData: buildJobLocationData(locationData),
      timeline: formData.timeline,
      jobDescription: formData.jobDescription.trim(),
      photoUrls,
      photoCount: photoUrls.length || formData.photos.length,
      fullName,
      email,
      phone: userId,
      jobType: dynamicJobType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(`[createJob] Failed to save global job ${jobId}:`, err);
    throw err;
  }

  let staggerCandidates: BusinessProfile[] = [];
  let staggerEligibleBusinessIds: string[] = [];
  try {
    const routeResult = await routeJobToMatchedBusinesses({
      jobId,
      formData: {
        ...formData,
        fullName,
        email,
      },
      uid,
      userId,
      businesses: matchedBusinesses,
      photoUrls,
      jobType: dynamicJobType,
    });
    staggerCandidates = routeResult.staggerCandidates;
    staggerEligibleBusinessIds = routeResult.eligibleBusinessIds;
  } catch (err) {
    console.error(
      `[createJob] Global job ${jobId} saved but business routing failed:`,
      err,
    );
  }

  return {
    jobId,
    matchedBusinesses,
    staggerCandidates,
    staggerEligibleBusinessIds,
    photoUrls,
  };
}

function userJobPhotoStoragePath(
  phoneId: string,
  jobId: string,
  index: number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `users/${phoneId}/photos/${jobId}_${index}_${safeName}`;
}

async function uploadUserJobPhotos(
  phoneId: string,
  jobId: string,
  photos: UploadedFile[],
): Promise<string[]> {
  if (photos.length === 0) return [];

  return Promise.all(
    photos.map(async (photo, index) => {
      const path = userJobPhotoStoragePath(phoneId, jobId, index, photo.file.name);
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, photo.file);
      return getDownloadURL(fileRef);
    }),
  );
}

/**
 * Flutter business app lists job leads from the `users` collection (type: user).
 * Mirror each additional job post in the same shape as signup.
 */
async function saveBusinessVisibleUserJobPost(
  formData: WizardFormData,
  uid: string,
  phoneId: string,
  jobId: string,
  photoUrls: string[],
): Promise<void> {
  const locationData = formData.locationData!;

  await setDoc(doc(db, USERS_COLLECTION, `${phoneId}_${jobId}`), {
    type: 'user' as const,
    location: locationData.displayLabel,
    locationData: {
      placeId: locationData.placeId,
      name: locationData.name,
      formattedAddress: locationData.formattedAddress,
      displayLabel: locationData.displayLabel,
      suburb: locationData.suburb,
      state: locationData.state,
      stateFullName: locationData.stateFullName,
      postcode: locationData.postcode,
      country: locationData.country,
      countryName: locationData.countryName,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      placeTypes: locationData.placeTypes,
    },
    timeline: formData.timeline,
    jobDescription: formData.jobDescription.trim(),
    photoNames: formData.photos.map((p) => p.file.name),
    photoUrls,
    photoCount: formData.photos.length,
    fullName: formData.fullName.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: phoneId,
    phoneNormalized: phoneId,
    isVerified: true,
    uid,
    jobId,
    isAdditionalJob: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function finalizeAdditionalJob(
  jobId: string,
  formData: WizardFormData,
  uid: string,
  userId: string,
  matchedBusinesses: BusinessProfile[],
): Promise<void> {
  try {
    // Business App New Jobs reads `users` — create that lead first.
    await saveBusinessVisibleUserJobPost(formData, uid, userId, jobId, []);

    if (!STAGGERED_ACCEPT_ENABLED) {
      void queueJobPostedEmails(formData, matchedBusinesses, {
        jobId,
        jobTitle: labelsFromJobType(currentJobType).title,
        customerLabel: 'A customer',
        matchedBusinessIds: matchedBusinesses.map((business) => business.id),
      })
        .then(() =>
          Promise.all(
            matchedBusinesses.filter(isAcceptedBusiness).map((acceptor) =>
              queueJobAcceptedEmail({
                to: formData.email,
                formData,
                acceptor,
              }),
            ),
          ),
        )
        .catch((err) => {
          console.error(`Failed to queue job notification email for ${jobId}:`, err);
        });

      void queueJobPostedCustomerEmail({
        to: formData.email,
        formData,
      }).catch((err) => {
        console.error(
          `Failed to queue customer job-posted email for ${jobId}:`,
          err,
        );
      });

      void queueJobPostedSms(formData, matchedBusinesses, {
        jobId,
        jobTitle: labelsFromJobType(currentJobType).title,
        customerLabel: 'A customer',
        matchedBusinessIds: matchedBusinesses.map((business) => business.id),
      })
        .then(() =>
          Promise.all(
            matchedBusinesses.filter(isAcceptedBusiness).map((acceptor) =>
              queueJobAcceptedSms({
                formData,
                acceptor,
                usersLeadDocId: `${userId}_${jobId}`,
                jobId,
              }),
            ),
          ),
        )
        .catch((err) => {
          console.error(`Failed to queue job notification SMS for ${jobId}:`, err);
        });
    }

    if (formData.photos.length === 0) return;

    const photoUrls = await uploadUserJobPhotos(userId, jobId, formData.photos);

    await Promise.all([
      updateDoc(doc(db, JOBS_COLLECTION, jobId), {
        photoUrls,
        photoCount: photoUrls.length,
        updatedAt: serverTimestamp(),
      }),
      saveBusinessVisibleUserJobPost(formData, uid, userId, jobId, photoUrls),
      updateRoutedJobPhotos({ jobId, businesses: matchedBusinesses, photoUrls }),
    ]);
  } catch (err) {
    console.error(`Failed to finalize additional job ${jobId}:`, err);
  }
}

export interface SaveAdditionalJobResult {
  jobId: string;
  matchedBusinesses: BusinessProfile[];
  staggerCandidates: BusinessProfile[];
  staggerAcceptPlan: StaggerAcceptPlan;
  postedNotificationsPayload: PostedNotificationsPayload;
}

/**
 * Saves an additional job for an existing user (Firestore + fan-out + emails).
 * Does not send the RTDB welcome message — that is only for first-time signup.
 *
 * Callers for returning users must pass profile `fullName` / `email` from the
 * Firestore user document — never UI form contact overrides.
 */
export async function saveAdditionalJob(
  formData: WizardFormData,
  uid: string,
  userId: string,
  options?: { prefetchedBusinesses?: BusinessProfile[] },
): Promise<SaveAdditionalJobResult> {
  const fullName = formData.fullName.trim();
  const email = (formData.email ?? '').trim().toLowerCase();

  const {
    jobId,
    matchedBusinesses,
    staggerCandidates,
    staggerEligibleBusinessIds,
    photoUrls,
  } = await createJob(formData, uid, userId, {
    fullName,
    email,
    prefetchedBusinesses: options?.prefetchedBusinesses,
  });

  await finalizeAdditionalJob(
    jobId,
    formData,
    uid,
    userId,
    matchedBusinesses,
  );

  return {
    jobId,
    matchedBusinesses,
    staggerCandidates,
    staggerAcceptPlan: {
      jobId,
      uid,
      userId,
      formData: {
        ...formData,
        fullName,
        email,
      },
      jobType: currentJobType,
      matchedBusinessIds: staggerEligibleBusinessIds,
      staggerCandidates,
      usersLeadDocIdForAcceptedSms: `${userId}_${jobId}`,
      photoUrls,
    },
    postedNotificationsPayload: buildPostedNotificationsPayload({
      formData,
      matchedBusinesses,
      jobId,
      customerLabel: 'A customer',
    }),
  };
}

/**
 * Queues a job post without blocking the UI. All Firestore, storage, and
 * email work runs in the background while the matching screen is shown.
 */
export function queueAdditionalJob(
  formData: WizardFormData,
  uid: string,
  userId: string,
  onSuccess?: (result: SaveAdditionalJobResult) => void,
): void {
  void saveAdditionalJob(formData, uid, userId)
    .then((result) => {
      onSuccess?.(result);
    })
    .catch(
      (err) => {
        console.error('Failed to save additional job:', err);
      },
    );
}

function formatJobCreatedDate(
  createdAt: { toDate?: () => Date } | Date | null | undefined,
): string {
  if (!createdAt) return 'Recently';

  const date =
    typeof createdAt === 'object' && createdAt !== null && 'toDate' in createdAt
      ? createdAt.toDate?.()
      : createdAt instanceof Date
        ? createdAt
        : null;

  if (!date) return 'Recently';

  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function formatJobStatus(status: string | undefined): string {
  switch (status) {
    case 'pending':
      return 'Accepted';
    case 'accepted':
      return 'Accepted';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Accepted';
  }
}

export interface UserJobListItem {
  id: string;
  title: string;
  category: string;
  jobType: JobType;
  createdDate: string;
  status: string;
  location: string;
  description: string;
  createdAtMs: number;
  matchedBusinessIds: string[];
}

const JOB_TYPE_LABELS: Record<
  JobType,
  {
    title: string;
    category: string;
  }
> = {
  fencing: {
    title: 'Fence Installation',
    category: 'Fence',
  },
  'retaining-wall': {
    title: 'Retaining Wall Installation',
    category: 'Retaining Wall',
  },
  decking: {
    title: 'Deck Installation',
    category: 'Decking',
  },
  landscaping: {
    title: 'Landscaping Project',
    category: 'Landscaping',
  },
};

export function labelsFromJobType(jobType: JobType): {
  title: string;
  category: string;
} {
  return JOB_TYPE_LABELS[jobType];
}

function resolveJobType(value: unknown): JobType {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(JOB_TYPE_LABELS, value)
    ? (value as JobType)
    : 'fencing';
}

function mapJobDoc(
  id: string,
  data: Record<string, unknown>,
): UserJobListItem {
  const createdAt = data.createdAt as { toDate?: () => Date } | undefined;
  const createdAtMs = createdAt?.toDate?.()?.getTime() ?? 0;
  const jobType = resolveJobType(data.jobType);
  const { title, category } = labelsFromJobType(jobType);

  return {
    id,
    title,
    category,
    jobType,
    createdDate: formatJobCreatedDate(createdAt),
    status: formatJobStatus(
      typeof data.status === 'string' ? data.status : 'pending',
    ),
    location: typeof data.location === 'string' ? data.location : '',
    description:
      typeof data.jobDescription === 'string' ? data.jobDescription : '',
    createdAtMs,
    matchedBusinessIds: Array.isArray(data.matchedBusinessIds)
      ? data.matchedBusinessIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export function buildSignupJobFromUser(
  user: {
    location?: string;
    jobDescription?: string;
    matchedBusinessIds?: string[];
    jobType?: string;
    createdAt?: { toDate?: () => Date };
  },
): UserJobListItem | null {
  if (!user.jobDescription?.trim() && !user.location?.trim()) {
    return null;
  }

  const createdAt = user.createdAt;
  const createdAtMs = createdAt?.toDate?.()?.getTime() ?? 0;
  const jobType = resolveJobType(user.jobType);
  const { title, category } = labelsFromJobType(jobType);

  return {
    id: 'signup-job',
    title,
    category,
    jobType,
    createdDate: formatJobCreatedDate(createdAt),
    status: 'Accepted',
    location: user.location ?? '',
    description: user.jobDescription?.trim() ?? '',
    createdAtMs: createdAtMs || Date.now(),
    matchedBusinessIds: Array.isArray(user.matchedBusinessIds)
      ? user.matchedBusinessIds
      : [],
  };
}

export function mergeUserJobs(
  signupJob: UserJobListItem | null,
  firestoreJobs: UserJobListItem[],
): UserJobListItem[] {
  // Once real jobs/{id} docs exist, drop the synthetic signup card.
  const raw =
    firestoreJobs.length > 0
      ? firestoreJobs
      : signupJob
        ? [signupJob]
        : [];

  return dedupeUserJobs(raw);
}

/**
 * Collapses accidental duplicates (OTP/retry double-writes, uid+userId
 * overlaps with different doc ids that are the same job content).
 */
export function dedupeUserJobs(jobs: UserJobListItem[]): UserJobListItem[] {
  const byDocId = new Map<string, UserJobListItem>();
  for (const job of jobs) {
    byDocId.set(job.id, job);
  }

  const sorted = [...byDocId.values()].sort(
    (a, b) => b.createdAtMs - a.createdAtMs,
  );
  const result: UserJobListItem[] = [];

  for (const job of sorted) {
    if (job.id === 'signup-job' && sorted.some((j) => j.id !== 'signup-job')) {
      continue;
    }

    const duplicate = result.find(
      (existing) =>
        existing.jobType === job.jobType &&
        existing.location === job.location &&
        existing.description === job.description &&
        Math.abs(existing.createdAtMs - job.createdAtMs) < 5 * 60 * 1000,
    );

    if (!duplicate) {
      result.push(job);
    }
  }

  return result;
}

/** Home feed: at most one latest card per supported jobType. */
export function latestJobsByType(jobs: UserJobListItem[]): UserJobListItem[] {
  const latestByType = new Map<JobType, UserJobListItem>();

  for (const job of [...jobs].sort((a, b) => b.createdAtMs - a.createdAtMs)) {
    if (!latestByType.has(job.jobType)) {
      latestByType.set(job.jobType, job);
    }
  }

  return [...latestByType.values()].sort(
    (a, b) => b.createdAtMs - a.createdAtMs,
  );
}

export function subscribeUserJobs(
  uid: string,
  userId: string,
  onChange: (jobs: UserJobListItem[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const jobsRef = collection(db, JOBS_COLLECTION);
  const byUidQuery = query(jobsRef, where('uid', '==', uid));
  const byUserIdQuery = userId
    ? query(jobsRef, where('userId', '==', userId))
    : null;

  let uidJobs: UserJobListItem[] = [];
  let userIdJobs: UserJobListItem[] = [];

  const emit = () => {
    const byId = new Map<string, UserJobListItem>();
    for (const job of [...uidJobs, ...userIdJobs]) {
      // Prefer canonical jobId field when present (same job, different doc paths).
      byId.set(job.id, job);
    }
    onChange(
      dedupeUserJobs(
        [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs),
      ),
    );
  };

  const mapSnapDoc = (docSnap: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnap.data();
    // Skip non-job docs that may share uid/userId queries accidentally.
    if (data.type != null && data.type !== 'job') {
      return null;
    }
    const mapped = mapJobDoc(docSnap.id, data);
    if (typeof data.jobId === 'string' && data.jobId.trim()) {
      return { ...mapped, id: data.jobId.trim() };
    }
    return mapped;
  };

  const unsubUid = onSnapshot(
    byUidQuery,
    (snapshot) => {
      uidJobs = snapshot.docs
        .map((docSnap) => mapSnapDoc(docSnap))
        .filter((job): job is UserJobListItem => job != null);
      emit();
    },
    (error) => {
      console.error('Failed to load jobs by uid:', error);
      onError?.(error);
    },
  );

  if (!byUserIdQuery) {
    return unsubUid;
  }

  const unsubUserId = onSnapshot(
    byUserIdQuery,
    (snapshot) => {
      userIdJobs = snapshot.docs
        .map((docSnap) => mapSnapDoc(docSnap))
        .filter((job): job is UserJobListItem => job != null);
      emit();
    },
    (error) => {
      console.error('Failed to load jobs by userId:', error);
      onError?.(error);
    },
  );

  return () => {
    unsubUid();
    unsubUserId();
  };
}
