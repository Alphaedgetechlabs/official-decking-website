import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { PhoneAlreadyRegisteredError } from '../errors/authErrors';
import { HARDCODED_JOB } from '../data/jobContractors';
import { db, storage } from '../firebase';
import type { TimelineOption, UploadedFile, WizardFormData } from '../types/wizard';
import { sanitizePhone } from '../utils/phone';
import { filterRealBusinesses } from '../lib/optimisticSignup';
import { fetchRandomBusinesses, type BusinessProfile } from './businessService';

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

async function queueJobRequestEmails(
  formData: WizardFormData,
  businesses?: BusinessProfile[],
): Promise<void> {
  const resolvedBusinesses = businesses ?? (await fetchRandomBusinesses(3));
  if (resolvedBusinesses.length === 0) return;

  const userName = formData.fullName.trim();
  const jobName = HARDCODED_JOB.title;
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
          subject: `New Job Request: ${jobName}`,
          html: `
      <h2>New Job Request Received</h2>
      <p>A new user has posted a job on the platform. Here are the details:</p>
      <ul>
        <li><strong>User Name:</strong> ${escapeHtml(userName)}</li>
        <li><strong>Job Name:</strong> ${escapeHtml(jobName)}</li>
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

export async function saveUserQuoteRequest(
  formData: WizardFormData,
  uid: string,
  preselectedBusinesses?: BusinessProfile[],
): Promise<{ phoneId: string; matchedBusinesses: BusinessProfile[]; photoUrls: string[] }> {
  const phoneId = sanitizePhone(formData.phone);
  const userRef = doc(db, USERS_COLLECTION, phoneId);

  if (await isPhoneRegistered(phoneId)) {
    throw new PhoneAlreadyRegisteredError();
  }

  if (!uid.trim()) {
    throw new Error('A verified Firebase Auth uid is required.');
  }

  const photoUrls = await uploadUserPhotos(phoneId, formData.photos);

  if (!formData.locationData) {
    throw new Error('A validated Australian location is required.');
  }

  const locationData = formData.locationData;
  const realPreselected = preselectedBusinesses
    ? filterRealBusinesses(preselectedBusinesses)
    : undefined;
  const matchedBusinesses =
    realPreselected && realPreselected.length > 0
      ? realPreselected
      : await fetchRandomBusinesses(3);
  const matchedBusinessIds = matchedBusinesses.map((business) => business.id);

  const formFields = {
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
    matchedBusinessIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, formFields);

  try {
    await queueJobRequestEmails(formData, matchedBusinesses);
  } catch (err) {
    console.error('Failed to queue job notification email:', err);
    if (err instanceof Error) {
      console.error(err.message);
    }
  }

  return { phoneId, matchedBusinesses, photoUrls };
}

/** Persist signup in the background after optimistic UI has advanced. */
export function queueSaveUserQuoteRequest(
  formData: WizardFormData,
  uid: string,
  preselectedBusinesses?: BusinessProfile[],
  onSuccess?: (result: {
    phoneId: string;
    matchedBusinesses: BusinessProfile[];
    matchedBusinessIds: string[];
    photoUrls: string[];
  }) => void,
): void {
  void saveUserQuoteRequest(formData, uid, preselectedBusinesses)
    .then(({ phoneId, matchedBusinesses, photoUrls }) => {
      onSuccess?.({
        phoneId,
        matchedBusinesses,
        matchedBusinessIds: matchedBusinesses.map((business) => business.id),
        photoUrls,
      });
    })
    .catch((err) => {
      console.error('Background account setup failed:', err);
    });
}
