import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { STAGGERED_ACCEPT_ENABLED } from '../config/autoAccept';
import { db, storage } from '../firebase';
import type { UploadedFile, WizardFormData } from '../types/wizard';
import { sanitizePhone } from '../utils/phone';
import type { BusinessProfile } from './businessService';
import {
  createJob,
  labelsFromJobType,
  type PostedNotificationsPayload,
  type StaggerAcceptPlan,
} from './jobService';
import { queueJobAcceptedEmail, queueJobAcceptedSms, queueJobPostedCustomerEmail, queueJobPostedEmails, queueJobPostedSms } from './mailService';
import { maybeSendFirstJobWelcomeMessage } from './rtdb/adminSupportChatService';
import { currentJobType } from '../config/brandDomain';
import { isAcceptedBusiness } from '../utils/businessMatchStatus';

const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'jobs';

function photoStoragePath(
  phoneId: string,
  index: number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `users/${phoneId}/photos/${index}_${safeName}`;
}

async function uploadUserPhotos(
  phoneId: string,
  photos: UploadedFile[],
): Promise<string[]> {
  if (photos.length === 0) return [];

  return Promise.all(
    photos.map(async (photo, index) => {
      const path = photoStoragePath(phoneId, index, photo.file.name);
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, photo.file);
      return getDownloadURL(storageRef);
    }),
  );
}

export async function isPhoneRegistered(phoneId: string): Promise<boolean> {
  const byId = await getDoc(doc(db, USERS_COLLECTION, phoneId));
  return byId.exists();
}

/**
 * Creates a brand-new user document (first job lives on the user doc) and
 * sends the RTDB welcome message. Call only for new registrations — existing
 * users should use `saveAdditionalJob` instead.
 *
 * Ordering matches saveAdditionalJob / "+": createJob first (throws on
 * failure). Account doc, photos, and notifications are best-effort after.
 */
export async function saveUserQuoteRequest(
  formData: WizardFormData,
  uid: string,
  options?: { prefetchedBusinesses?: BusinessProfile[] },
): Promise<{
  phoneId: string;
  matchedBusinesses: BusinessProfile[];
  staggerCandidates: BusinessProfile[];
  staggerAcceptPlan: StaggerAcceptPlan;
  postedNotificationsPayload: PostedNotificationsPayload;
  photoUrls: string[];
}> {
  const phoneId = sanitizePhone(formData.phone);
  const userRef = doc(db, USERS_COLLECTION, phoneId);

  if (!uid.trim()) {
    throw new Error('A verified Firebase Auth uid is required.');
  }

  if (!formData.locationData) {
    throw new Error('A validated Australian location is required.');
  }

  const locationData = formData.locationData;
  const prefetchedBusinesses = options?.prefetchedBusinesses ?? [];

  // Same as "+": job + routing must exist before anything else.
  const {
    jobId,
    matchedBusinesses,
    staggerCandidates,
    staggerEligibleBusinessIds,
    photoUrls: routedPhotoUrls,
  } = await createJob(formData, uid, phoneId, {
    photoUrls: [],
    prefetchedBusinesses,
  });
  const matchedBusinessIds = matchedBusinesses.map((business) => business.id);

  let photoUrls: string[] = [];

  try {
    await setDoc(userRef, {
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
      photoUrls: [],
      photoCount: formData.photos.length,
      fullName: formData.fullName.trim(),
      email: (formData.email ?? '').trim().toLowerCase(),
      phone: phoneId,
      phoneNormalized: phoneId,
      isVerified: true,
      uid,
      matchedBusinessIds,
      status: 'open' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(`Failed to save user account doc for ${phoneId}:`, err);
  }

  if (formData.photos.length > 0) {
    try {
      photoUrls = await uploadUserPhotos(phoneId, formData.photos);
      await Promise.all([
        updateDoc(doc(db, JOBS_COLLECTION, jobId), {
          photoUrls,
          photoCount: photoUrls.length,
          updatedAt: serverTimestamp(),
        }),
        updateDoc(userRef, {
          photoUrls,
          photoCount: photoUrls.length,
          updatedAt: serverTimestamp(),
        }),
      ]);
    } catch (err) {
      console.error(`Failed to upload/patch photos for job ${jobId}:`, err);
    }
  }

  if (!STAGGERED_ACCEPT_ENABLED) {
    void queueJobPostedEmails(formData, matchedBusinesses, {
      jobId,
      jobTitle: labelsFromJobType(currentJobType).title,
      customerLabel: 'A new user',
      matchedBusinessIds,
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
      customerLabel: 'A new user',
      matchedBusinessIds,
    })
      .then(() =>
        Promise.all(
          matchedBusinesses.filter(isAcceptedBusiness).map((acceptor) =>
            queueJobAcceptedSms({
              formData,
              acceptor,
              usersLeadDocId: phoneId,
              jobId,
            }),
          ),
        ),
      )
      .catch((err) => {
        console.error(`Failed to queue job notification SMS for ${jobId}:`, err);
      });
  }

  void maybeSendFirstJobWelcomeMessage(phoneId).catch((err) => {
    console.error('Failed to send first-job welcome support message:', err);
  });

  return {
    phoneId,
    matchedBusinesses,
    staggerCandidates,
    staggerAcceptPlan: {
      jobId,
      uid,
      userId: phoneId,
      formData,
      jobType: currentJobType,
      matchedBusinessIds: staggerEligibleBusinessIds,
      staggerCandidates,
      usersLeadDocIdForAcceptedSms: phoneId,
      // Same value createJob passed into route (not post-upload photoUrls).
      photoUrls: routedPhotoUrls,
    },
    postedNotificationsPayload: {
      formData,
      matchedBusinesses,
      options: {
        jobId,
        jobTitle: labelsFromJobType(currentJobType).title,
        customerLabel: 'A new user',
        matchedBusinessIds,
      },
    },
    photoUrls,
  };
}

/** Persist signup in the background after optimistic UI has advanced. */
export function queueSaveUserQuoteRequest(
  formData: WizardFormData,
  uid: string,
  onSuccess?: (result: {
    phoneId: string;
    matchedBusinesses: BusinessProfile[];
    staggerCandidates: BusinessProfile[];
    staggerAcceptPlan: StaggerAcceptPlan;
    postedNotificationsPayload: PostedNotificationsPayload;
    matchedBusinessIds: string[];
    photoUrls: string[];
  }) => void,
): void {
  void saveUserQuoteRequest(formData, uid)
    .then(({ phoneId, matchedBusinesses, staggerCandidates, staggerAcceptPlan, postedNotificationsPayload, photoUrls }) => {
      onSuccess?.({
        phoneId,
        matchedBusinesses,
        staggerCandidates,
        staggerAcceptPlan,
        postedNotificationsPayload,
        matchedBusinessIds: matchedBusinesses.map((business) => business.id),
        photoUrls,
      });
    })
    .catch((err) => {
      console.error('Background account setup failed:', err);
    });
}
