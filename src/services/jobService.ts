import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { HARDCODED_JOB } from '../data/jobContractors';
import { db, storage } from '../firebase';
import type { TimelineOption, UploadedFile, WizardFormData } from '../types/wizard';
import { fetchRandomBusinesses, type BusinessProfile } from './businessService';

const JOBS_COLLECTION = 'jobs';
const USERS_COLLECTION = 'users';
const MAIL_COLLECTION = 'mail';

const TIMELINE_LABELS: Record<TimelineOption, string> = {
  asap: 'ASAP',
  'within-2-weeks': 'Within 2 weeks',
  'in-a-month': 'In a month',
  comparing: 'Just comparing quotes',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

async function queueJobNotificationEmails(
  formData: WizardFormData,
  jobTitle: string,
  businesses?: BusinessProfile[],
): Promise<void> {
  const resolvedBusinesses = businesses ?? (await fetchRandomBusinesses(3));
  if (resolvedBusinesses.length === 0) return;

  const userName = formData.fullName.trim();
  const area = formData.locationData!.displayLabel;
  const time =
    formData.timeline !== ''
      ? TIMELINE_LABELS[formData.timeline]
      : 'Not specified';
  const description = formData.jobDescription.trim();
  const mailRef = collection(db, MAIL_COLLECTION);

  const businessesWithEmail = resolvedBusinesses.filter(
    (business) => typeof business.email === 'string' && business.email.trim().length > 0,
  );

  if (businessesWithEmail.length === 0) {
    console.warn('No businesses with a valid email address were found for job notifications.');
    return;
  }

  await Promise.all(
    businessesWithEmail.map((business) => {
      const businessPersonEmail = business.email.trim().toLowerCase();

      return addDoc(mailRef, {
        to: businessPersonEmail,
        message: {
          subject: `New Job Request: ${jobTitle}`,
          html: `
      <h2>New Job Request Received</h2>
      <p>A customer has posted a new job on the platform. Here are the details:</p>
      <ul>
        <li><strong>User Name:</strong> ${escapeHtml(userName)}</li>
        <li><strong>Job Name:</strong> ${escapeHtml(jobTitle)}</li>
        <li><strong>Area/Location:</strong> ${escapeHtml(area)}</li>
        <li><strong>Time:</strong> ${escapeHtml(time)}</li>
      </ul>
      <h3>Description:</h3>
      <p>${escapeHtml(description)}</p>
      <br>
      <p>Please open the Business App to accept or review this job.</p>
    `,
        },
      });
    }),
  );
}

async function finalizeAdditionalJob(
  jobId: string,
  formData: WizardFormData,
  uid: string,
  userId: string,
  matchedBusinesses: BusinessProfile[],
  matchedBusinessIds: string[],
  locationData: NonNullable<WizardFormData['locationData']>,
): Promise<void> {
  const locationPayload = {
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
  };

  try {
    await Promise.all([
      saveBusinessVisibleUserJobPost(formData, uid, userId, jobId, []),
      Promise.all(
        matchedBusinesses.map((business) =>
          setDoc(doc(db, 'businesses', business.id, 'incomingJobs', jobId), {
            jobId,
            businessId: business.id,
            userId,
            uid,
            type: 'job',
            title: HARDCODED_JOB.title,
            category: HARDCODED_JOB.category,
            status: 'accepted',
            matchedBusinessIds,
            location: locationData.displayLabel,
            locationData: locationPayload,
            timeline: formData.timeline,
            jobDescription: formData.jobDescription.trim(),
            photoUrls: [],
            photoCount: formData.photos.length,
            fullName: formData.fullName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        ),
      ),
    ]);

    void queueJobNotificationEmails(
      formData,
      HARDCODED_JOB.title,
      matchedBusinesses,
    ).catch((err) => {
      console.error('Failed to queue job notification email:', err);
      if (err instanceof Error) {
        console.error(err.message);
      }
    });

    if (formData.photos.length === 0) return;

    const photoUrls = await uploadUserJobPhotos(userId, jobId, formData.photos);

    await Promise.all([
      updateDoc(doc(db, JOBS_COLLECTION, jobId), {
        photoUrls,
        photoCount: photoUrls.length,
        updatedAt: serverTimestamp(),
      }),
      saveBusinessVisibleUserJobPost(formData, uid, userId, jobId, photoUrls),
      Promise.all(
        matchedBusinesses.map((business) =>
          updateDoc(doc(db, 'businesses', business.id, 'incomingJobs', jobId), {
            photoUrls,
            photoCount: photoUrls.length,
            updatedAt: serverTimestamp(),
          }),
        ),
      ),
    ]);
  } catch (err) {
    console.error(`Failed to finalize additional job ${jobId}:`, err);
  }
}

/**
 * Queues a job post without blocking the UI. All Firestore, storage, and
 * email work runs in the background while the matching screen is shown.
 */
export function queueAdditionalJob(
  formData: WizardFormData,
  uid: string,
  userId: string,
  preselectedBusinesses?: BusinessProfile[],
): void {
  if (!uid.trim()) {
    console.error('A verified Firebase Auth uid is required.');
    return;
  }

  if (!formData.locationData) {
    console.error('A validated Australian location is required.');
    return;
  }

  void runAdditionalJobSave(formData, uid, userId, preselectedBusinesses);
}

async function runAdditionalJobSave(
  formData: WizardFormData,
  uid: string,
  userId: string,
  preselectedBusinesses?: BusinessProfile[],
): Promise<void> {
  const locationData = formData.locationData!;

  try {
    const matchedBusinesses =
      preselectedBusinesses && preselectedBusinesses.length > 0
        ? preselectedBusinesses
        : await fetchRandomBusinesses(3);
    const matchedBusinessIds = matchedBusinesses.map((business) => business.id);

    const jobRef = doc(collection(db, JOBS_COLLECTION));

    await setDoc(jobRef, {
      userId,
      uid,
      type: 'job' as const,
      title: HARDCODED_JOB.title,
      category: HARDCODED_JOB.category,
      status: 'accepted' as const,
      matchedBusinessIds,
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
      photoUrls: [] as string[],
      photoCount: formData.photos.length,
      fullName: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await finalizeAdditionalJob(
      jobRef.id,
      formData,
      uid,
      userId,
      matchedBusinesses,
      matchedBusinessIds,
      locationData,
    );
  } catch (err) {
    console.error('Failed to save additional job:', err);
  }
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
  createdDate: string;
  status: string;
  location: string;
  description: string;
  createdAtMs: number;
  matchedBusinessIds: string[];
}

function mapJobDoc(
  id: string,
  data: Record<string, unknown>,
): UserJobListItem {
  const createdAt = data.createdAt as { toDate?: () => Date } | undefined;
  const createdAtMs = createdAt?.toDate?.()?.getTime() ?? 0;

  return {
    id,
    title: typeof data.title === 'string' ? data.title : HARDCODED_JOB.title,
    category: typeof data.category === 'string' ? data.category : HARDCODED_JOB.category,
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
    createdAt?: { toDate?: () => Date };
  },
): UserJobListItem | null {
  if (!user.jobDescription?.trim() && !user.location?.trim()) {
    return null;
  }

  const createdAt = user.createdAt;
  const createdAtMs = createdAt?.toDate?.()?.getTime() ?? 0;

  return {
    id: 'signup-job',
    title: HARDCODED_JOB.title,
    category: HARDCODED_JOB.category,
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
  const merged = signupJob ? [signupJob, ...firestoreJobs] : firestoreJobs;
  return merged.sort((a, b) => b.createdAtMs - a.createdAtMs);
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
      byId.set(job.id, job);
    }
    onChange(
      [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs),
    );
  };

  const unsubUid = onSnapshot(
    byUidQuery,
    (snapshot) => {
      uidJobs = snapshot.docs.map((docSnap) =>
        mapJobDoc(docSnap.id, docSnap.data()),
      );
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
      userIdJobs = snapshot.docs.map((docSnap) =>
        mapJobDoc(docSnap.id, docSnap.data()),
      );
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
