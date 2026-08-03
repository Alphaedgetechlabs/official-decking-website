import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { currentJobType } from '../config/brandDomain';
import { db } from '../firebase';
import type { TimelineOption, WizardFormData } from '../types/wizard';
import { formatPhoneForAuth } from '../utils/phone';
import {
  fetchBusinessesByIds,
  type BusinessProfile,
} from './businessService';
import { labelsFromJobType } from './jobService';

const MAIL_COLLECTION = 'mail';
const MESSAGES_COLLECTION = 'messages';
const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'jobs';
const BUSINESSES_COLLECTION = 'businesses';

function extractBusinessEmail(
  business: Partial<BusinessProfile> | Record<string, unknown> | undefined,
): string | null {
  if (!business) return null;

  const candidates = [
    business.email,
    (business as Record<string, unknown>).businessEmail,
    (business as Record<string, unknown>).contactEmail,
    (business as Record<string, unknown>).ownerEmail,
    (business as Record<string, unknown>).businessPersonEmail,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }

  return null;
}

function normalizeCustomerEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSmsPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return formatPhoneForAuth(trimmed);
  } catch {
    return null;
  }
}

function extractBusinessPhone(
  business: Partial<BusinessProfile> | Record<string, unknown> | undefined,
): string | null {
  if (!business) return null;

  const candidates = [
    business.phone,
    (business as Record<string, unknown>).phoneNormalized,
    (business as Record<string, unknown>).businessPhone,
    (business as Record<string, unknown>).contactPhone,
  ];

  for (const value of candidates) {
    const normalized = normalizeSmsPhone(value);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * Resolves the customer's email for job-accepted notifications.
 * Tries formData first, then Firestore docs written during job creation.
 */
export async function resolveCustomerEmailForAcceptedJob(params: {
  formData: WizardFormData;
  usersLeadDocId: string;
  jobId?: string;
}): Promise<string | null> {
  const { formData, usersLeadDocId, jobId } = params;

  const fromForm = normalizeCustomerEmail(formData.email);
  console.log('[resolveCustomerEmail] formData.email:', {
    raw: formData.email,
    normalized: fromForm,
  });
  if (fromForm) return fromForm;

  const usersLeadSnap = await getDoc(doc(db, USERS_COLLECTION, usersLeadDocId));
  const fromUsersLead = normalizeCustomerEmail(usersLeadSnap.data()?.email);
  console.log('[resolveCustomerEmail] users lead doc:', {
    path: `${USERS_COLLECTION}/${usersLeadDocId}`,
    exists: usersLeadSnap.exists(),
    email: usersLeadSnap.data()?.email,
    normalized: fromUsersLead,
  });
  if (fromUsersLead) return fromUsersLead;

  const resolvedJobId =
    jobId ??
    (usersLeadDocId.includes('_')
      ? usersLeadDocId.slice(usersLeadDocId.indexOf('_') + 1)
      : undefined);

  if (resolvedJobId) {
    const jobSnap = await getDoc(doc(db, JOBS_COLLECTION, resolvedJobId));
    const fromJob = normalizeCustomerEmail(jobSnap.data()?.email);
    console.log('[resolveCustomerEmail] jobs doc:', {
      path: `${JOBS_COLLECTION}/${resolvedJobId}`,
      exists: jobSnap.exists(),
      email: jobSnap.data()?.email,
      normalized: fromJob,
    });
    if (fromJob) return fromJob;
  }

  const phoneId = usersLeadDocId.includes('_')
    ? usersLeadDocId.slice(0, usersLeadDocId.indexOf('_'))
    : usersLeadDocId;

  if (phoneId !== usersLeadDocId) {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, phoneId));
    const fromUserProfile = normalizeCustomerEmail(userSnap.data()?.email);
    console.log('[resolveCustomerEmail] user profile doc:', {
      path: `${USERS_COLLECTION}/${phoneId}`,
      exists: userSnap.exists(),
      email: userSnap.data()?.email,
      normalized: fromUserProfile,
    });
    if (fromUserProfile) return fromUserProfile;
  }

  console.warn('[resolveCustomerEmail] No customer email found from any source.', {
    usersLeadDocId,
    jobId: resolvedJobId,
  });
  return null;
}

/**
 * Resolves the customer's phone for job-accepted SMS.
 * Tries formData first, then Firestore docs written during job creation.
 */
export async function resolveCustomerPhoneForAcceptedJob(params: {
  formData: WizardFormData;
  usersLeadDocId: string;
  jobId?: string;
}): Promise<string | null> {
  const { formData, usersLeadDocId, jobId } = params;

  const fromForm = normalizeSmsPhone(formData.phone);
  if (fromForm) return fromForm;

  const usersLeadSnap = await getDoc(doc(db, USERS_COLLECTION, usersLeadDocId));
  const usersLeadData = usersLeadSnap.data();
  const fromUsersLead =
    normalizeSmsPhone(usersLeadData?.phone) ??
    normalizeSmsPhone(usersLeadData?.phoneNormalized);
  if (fromUsersLead) return fromUsersLead;

  const resolvedJobId =
    jobId ??
    (usersLeadDocId.includes('_')
      ? usersLeadDocId.slice(usersLeadDocId.indexOf('_') + 1)
      : undefined);

  if (resolvedJobId) {
    const jobSnap = await getDoc(doc(db, JOBS_COLLECTION, resolvedJobId));
    const jobData = jobSnap.data();
    const fromJob =
      normalizeSmsPhone(jobData?.phone) ??
      normalizeSmsPhone(jobData?.phoneNormalized);
    if (fromJob) return fromJob;
  }

  const phoneId = usersLeadDocId.includes('_')
    ? usersLeadDocId.slice(0, usersLeadDocId.indexOf('_'))
    : usersLeadDocId;

  if (phoneId !== usersLeadDocId) {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, phoneId));
    const userData = userSnap.data();
    const fromUserProfile =
      normalizeSmsPhone(userData?.phone) ??
      normalizeSmsPhone(userData?.phoneNormalized);
    if (fromUserProfile) return fromUserProfile;
  }

  return null;
}

function businessesWithValidPhone(
  businesses: BusinessProfile[],
): BusinessProfile[] {
  const seen = new Set<string>();

  return businesses
    .map((business) => {
      const phone = extractBusinessPhone(business);
      return phone ? { ...business, phone } : null;
    })
    .filter((business): business is BusinessProfile => {
      if (!business) return false;
      if (seen.has(business.phone)) return false;
      seen.add(business.phone);
      return true;
    });
}

async function resolveJobSmsRecipients(
  businesses: BusinessProfile[],
  options: {
    matchedBusinessIds?: string[];
  },
): Promise<BusinessProfile[]> {
  const ids =
    options.matchedBusinessIds && options.matchedBusinessIds.length > 0
      ? options.matchedBusinessIds
      : businesses.map((business) => business.id).filter(Boolean);

  let candidates = businesses;
  if (ids.length > 0) {
    const fetched = await fetchBusinessesByIds(ids);
    const fetchedById = new Map(fetched.map((business) => [business.id, business]));
    candidates = ids
      .map(
        (id) =>
          fetchedById.get(id) ??
          businesses.find((business) => business.id === id),
      )
      .filter((business): business is BusinessProfile => business != null);
  }

  if (candidates.length === 0 && businesses.length > 0) {
    candidates = businesses;
  }

  let withPhone = businessesWithValidPhone(candidates);
  if (withPhone.length > 0) return withPhone;

  const hydrated = await resolveBusinessesWithEmail(candidates);
  return businessesWithValidPhone(hydrated);
}

async function queueSmsDocument(to: string, body: string): Promise<void> {
  const normalizedTo = normalizeSmsPhone(to);
  const normalizedBody = typeof body === 'string' ? body.trim() : '';

  if (!normalizedTo) {
    console.warn('[queueSmsDocument] Skipping SMS write due to invalid to.', {
      to,
    });
    return;
  }

  if (!normalizedBody) {
    console.warn('[queueSmsDocument] Skipping SMS write due to empty body.', {
      to: normalizedTo,
      body,
    });
    return;
  }

  await addDoc(collection(db, MESSAGES_COLLECTION), {
    to: normalizedTo,
    body: normalizedBody,
  });
}

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

/**
 * Hydrates business profiles from Firestore when callers only have stub IDs
 * (e.g. configured auto-accept IDs without full profile data).
 */
function businessesWithValidEmail(
  businesses: BusinessProfile[],
): BusinessProfile[] {
  const seen = new Set<string>();

  return businesses
    .map((business) => {
      const email = extractBusinessEmail(business);
      return email ? { ...business, email } : null;
    })
    .filter((business): business is BusinessProfile => {
      if (!business) return false;
      if (seen.has(business.email)) return false;
      seen.add(business.email);
      return true;
    });
}

async function fetchBusinessProfileForNotification(
  business: BusinessProfile,
): Promise<BusinessProfile | null> {
  const inlineEmail = extractBusinessEmail(business);
  if (inlineEmail) {
    return { ...business, email: inlineEmail };
  }

  const lookupIds = [
    ...new Set([business.id, business.uid?.trim()].filter(Boolean)),
  ] as string[];

  for (const lookupId of lookupIds) {
    const snap = await getDoc(doc(db, BUSINESSES_COLLECTION, lookupId));
    if (!snap.exists()) continue;

    const data = snap.data() as BusinessProfile;
    const email = extractBusinessEmail(data);
    if (!email) continue;

    return {
      ...business,
      ...data,
      id: snap.id,
      email,
    };
  }

  return null;
}

async function resolveJobNotificationRecipients(
  businesses: BusinessProfile[],
  options: {
    matchedBusinessIds?: string[];
  },
): Promise<BusinessProfile[]> {
  const ids =
    options.matchedBusinessIds && options.matchedBusinessIds.length > 0
      ? options.matchedBusinessIds
      : businesses.map((business) => business.id).filter(Boolean);

  let candidates = businesses;
  if (ids.length > 0) {
    const fetched = await fetchBusinessesByIds(ids);
    const fetchedById = new Map(fetched.map((business) => [business.id, business]));
    candidates = ids
      .map(
        (id) =>
          fetchedById.get(id) ??
          businesses.find((business) => business.id === id),
      )
      .filter((business): business is BusinessProfile => business != null);
  }

  if (candidates.length === 0 && businesses.length > 0) {
    candidates = businesses;
  }

  let withEmail = businessesWithValidEmail(candidates);
  if (withEmail.length > 0) return withEmail;

  const hydrated = await resolveBusinessesWithEmail(candidates);
  withEmail = businessesWithValidEmail(hydrated);
  if (withEmail.length > 0) return withEmail;

  return [];
}

export async function resolveBusinessesWithEmail(
  businesses: BusinessProfile[],
): Promise<BusinessProfile[]> {
  if (businesses.length === 0) return [];

  const hydrated = await Promise.all(
    businesses.map((business) => fetchBusinessProfileForNotification(business)),
  );

  return hydrated.filter(
    (business): business is BusinessProfile => business != null,
  );
}

/**
 * Queues Trigger Email extension documents for businesses when a job is posted.
 */
export async function queueJobPostedEmails(
  formData: WizardFormData,
  businesses: BusinessProfile[],
  options: {
    jobId: string;
    jobTitle?: string;
    customerLabel?: string;
    matchedBusinessIds?: string[];
  },
): Promise<void> {
  const businessesWithEmail = await resolveJobNotificationRecipients(businesses, {
    matchedBusinessIds: options.matchedBusinessIds,
  });

  if (businessesWithEmail.length === 0) {
    console.warn(
      '[queueJobPostedEmails] No business recipients could be resolved.',
      { jobId: options.jobId, matchedBusinessIds: options.matchedBusinessIds },
    );
    return;
  }

  const userName = formData.fullName.trim();
  const { title, category } = labelsFromJobType(currentJobType);
  const jobTitle = options?.jobTitle ?? title;
  const customerLabel = options?.customerLabel ?? 'A new user';
  const locationData = formData.locationData;
  const area =
    locationData?.displayLabel?.trim() ||
    formData.location.trim() ||
    'Not specified';
  const suburb = locationData?.suburb?.trim() || 'Not specified';
  const time =
    formData.timeline !== ''
      ? TIMELINE_LABELS[formData.timeline]
      : 'Not specified';
  const description = formData.jobDescription.trim();
  const mailRef = collection(db, MAIL_COLLECTION);

  console.log('[queueJobPostedEmails] Queueing job notification emails:', {
    jobId: options.jobId,
    recipients: businessesWithEmail.map((business) => business.email),
  });

  await Promise.all(
    businessesWithEmail.map((business) => {
      const businessPersonEmail = business.email.trim().toLowerCase();

      return addDoc(mailRef, {
        to: businessPersonEmail,
        message: {
          subject: `New Job Request: ${jobTitle}`,
          html: `
      <h2>New Job Request Received</h2>
      <p>${escapeHtml(customerLabel)} has posted a new job on the platform. Here are the details:</p>
      <ul>
        <li><strong>Job ID:</strong> ${escapeHtml(options.jobId)}</li>
        <li><strong>User Name:</strong> ${escapeHtml(userName)}</li>
        <li><strong>Job Title:</strong> ${escapeHtml(jobTitle)}</li>
        <li><strong>Category:</strong> ${escapeHtml(category)}</li>
        <li><strong>Area/Location:</strong> ${escapeHtml(area)}</li>
        <li><strong>Suburb:</strong> ${escapeHtml(suburb)}</li>
        <li><strong>Timeline:</strong> ${escapeHtml(time)}</li>
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

async function resolveAcceptorDetails(business: BusinessProfile): Promise<{
  businessName: string;
  phone: string;
  email: string;
}> {
  let businessName = business.businessName?.trim() ?? '';
  let phone = business.phone?.trim() ?? '';
  let email = extractBusinessEmail(business) ?? '';

  if (!businessName || !phone || !email) {
    const fromDb = (await fetchBusinessesByIds([business.id]))[0];
    if (fromDb) {
      businessName = businessName || fromDb.businessName?.trim() || '';
      phone = phone || fromDb.phone?.trim() || '';
      email = email || extractBusinessEmail(fromDb) || '';
    }
  }

  return {
    businessName: businessName || 'A business',
    phone: phone || 'Not provided',
    email: email || 'Not provided',
  };
}

export interface AcceptedBusinessEmailCard {
  businessName: string;
  rating?: number;
  reviewCount?: number;
}

export interface JobAcceptedEmailParams {
  to: string;
  formData: WizardFormData;
  acceptor: BusinessProfile;
  jobTitle?: string;
  /** Stagger position 1–3. Omit for plain body (flag-false / non-stagger paths). */
  position?: 1 | 2 | 3;
  /** Businesses accepted so far (length === position). Stagger path only. */
  acceptedSoFar?: AcceptedBusinessEmailCard[];
}

const ACCEPTED_CARD_SUBTITLES: Array<(name: string) => string> = [
  (name) => `${name} is available for your job.`,
  () => 'Competitive quotes coming your way.',
  () => '3 local pros are ready to quote.',
];

function formatAcceptedRatingLine(
  rating: number | undefined,
  reviewCount: number | undefined,
): string {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return '';
  const ratingHtml = escapeHtml(String(rating));
  if (typeof reviewCount !== 'number' || !Number.isFinite(reviewCount)) {
    return `<div style="font-size:13px;color:#6B6B6B;line-height:18px;padding-top:3px;"><span style="color:#E17A47;">&#9733;</span> <strong style="color:#1A1A1A;">${ratingHtml}</strong></div>`;
  }
  return `<div style="font-size:13px;color:#6B6B6B;line-height:18px;padding-top:3px;"><span style="color:#E17A47;">&#9733;</span> <strong style="color:#1A1A1A;">${ratingHtml}</strong> &bull; ${escapeHtml(String(reviewCount))} reviews</div>`;
}

function renderAcceptedBusinessCardHtml(
  card: AcceptedBusinessEmailCard,
  index: number,
): string {
  const name = card.businessName.trim() || 'A business';
  const nameHtml = escapeHtml(name);
  const ratingLine = formatAcceptedRatingLine(card.rating, card.reviewCount);
  const subtitleFn = ACCEPTED_CARD_SUBTITLES[index] ?? ACCEPTED_CARD_SUBTITLES[0];
  const subtitleHtml = escapeHtml(subtitleFn(name));
  const marginTop = index === 0 ? '20px' : '14px';

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #F0F0F0;border-radius:14px;margin-top:${marginTop};table-layout:fixed;">
              <tr>
                <td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
                    <tr>
                      <td width="38" valign="top" style="width:38px;">
                        <div style="width:34px;height:34px;background-color:#FDEEE5;border-radius:17px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:34px;color:#E17A47;">&#10003;</div>
                      </td>
                      <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
                      <td valign="top" style="font-family:Helvetica,Arial,sans-serif;">
                        <div style="font-size:15px;font-weight:bold;color:#1A1A1A;line-height:20px;">${nameHtml}</div>
                        ${ratingLine}
                        <div style="font-size:13px;font-weight:bold;color:#22A45D;line-height:18px;padding-top:6px;">&#10003; Accepted!</div>
                        <div style="font-size:13px;color:#6B6B6B;line-height:18px;padding-top:3px;">${subtitleHtml}</div>
                      </td>
                      <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="24" valign="top" style="width:24px;">
                        <div style="width:22px;height:22px;background-color:#22A45D;border-radius:11px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:22px;color:#FFFFFF;">&#10003;</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

function renderAcceptedSkeletonCardHtml(isFirstCard: boolean): string {
  const marginTop = isFirstCard ? '20px' : '14px';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #F0F0F0;border-radius:14px;margin-top:${marginTop};table-layout:fixed;">
              <tr>
                <td style="padding:18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
                    <tr>
                      <td width="36" valign="top" style="width:36px;">
                        <div style="width:36px;height:36px;background-color:#E9E9E9;border-radius:18px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                      <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
                      <td valign="top">
                        <div style="height:10px;background-color:#EDEDED;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;width:45%;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:12px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;width:62%;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                      <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="22" valign="top" style="width:22px;">
                        <div style="width:22px;height:22px;background-color:#E9E9E9;border-radius:11px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

function buildStaggerAcceptedEmailHtml(params: {
  firstName: string;
  tradeLabel: string;
  position: 1 | 2 | 3;
  acceptedSoFar: AcceptedBusinessEmailCard[];
}): string {
  const firstNameHtml = escapeHtml(params.firstName);
  const tradeLabelHtml = escapeHtml(params.tradeLabel);
  const cards = params.acceptedSoFar.slice(0, params.position);

  const bannerText =
    params.position === 3 ? 'Congratulations!' : 'Job Post Accepted';
  const headline =
    params.position === 1
      ? `Congratulations ${firstNameHtml}, first contractor to accept your job post`
      : params.position === 2
        ? `Congratulations ${firstNameHtml}, second contractor to accept your job post`
        : `It's easy to Get 3 quotes now`;

  const greenBox =
    params.position === 1
      ? `<div style="font-size:15px;font-weight:bold;color:#1A1A1A;line-height:21px;">Don't worry we're working even harder to find you more contractors.</div>`
      : params.position === 2
        ? `<div style="font-size:15px;font-weight:bold;color:#1A1A1A;line-height:21px;">Don't worry one more to go and we're working even harder.</div>`
        : `<div style="font-size:15px;font-weight:bold;color:#1A1A1A;line-height:21px;">Your quotes are being prepared now!</div><div style="font-size:13px;color:#5B5B5B;line-height:19px;padding-top:4px;">We've matched you with 3 top-rated ${tradeLabelHtml} contractors. You'll receive your quotes shortly.</div>`;

  const footerMain =
    params.position === 1
      ? 'Talk to your first contractor to give you a quote as soon as possible..'
      : params.position === 2
        ? 'Talk to the contractors as soon as you can so you can get your quotes in now time.'
        : 'Your quotes could arrive in the next 3&ndash;7 minutes.';

  const skeletonCount = Math.max(0, 3 - cards.length);
  const cardRows =
    cards.map((card, i) => renderAcceptedBusinessCardHtml(card, i)).join('') +
    Array.from({ length: skeletonCount }, (_, i) =>
      renderAcceptedSkeletonCardHtml(cards.length + i === 0),
    ).join('');

  const featuresStrip =
    params.position === 3
      ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:22px;table-layout:fixed;">
              <tr>
                <td width="25%" align="center" valign="top" style="width:25%;font-family:Helvetica,Arial,sans-serif;">
                  <div style="width:34px;height:34px;background-color:#FDEEE5;border-radius:17px;text-align:center;font-size:15px;line-height:34px;color:#E17A47;margin:0 auto;">&#9679;</div>
                  <div style="font-size:10px;color:#6B6B6B;line-height:14px;padding-top:6px;">Verified Pros</div>
                </td><td width="25%" align="center" valign="top" style="width:25%;font-family:Helvetica,Arial,sans-serif;">
                  <div style="width:34px;height:34px;background-color:#FDEEE5;border-radius:17px;text-align:center;font-size:15px;line-height:34px;color:#E17A47;margin:0 auto;">&#10003;</div>
                  <div style="font-size:10px;color:#6B6B6B;line-height:14px;padding-top:6px;">Licensed &amp; Insured</div>
                </td><td width="25%" align="center" valign="top" style="width:25%;font-family:Helvetica,Arial,sans-serif;">
                  <div style="width:34px;height:34px;background-color:#FDEEE5;border-radius:17px;text-align:center;font-size:15px;line-height:34px;color:#E17A47;margin:0 auto;">&#9733;</div>
                  <div style="font-size:10px;color:#6B6B6B;line-height:14px;padding-top:6px;">Reviewed by Locals</div>
                </td><td width="25%" align="center" valign="top" style="width:25%;font-family:Helvetica,Arial,sans-serif;">
                  <div style="width:34px;height:34px;background-color:#FDEEE5;border-radius:17px;text-align:center;font-size:15px;line-height:34px;color:#E17A47;margin:0 auto;">&#9889;</div>
                  <div style="font-size:10px;color:#6B6B6B;line-height:14px;padding-top:6px;">Fast Response</div>
                </td>
              </tr>
            </table>`
      : '';

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;margin:0;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background-color:#FFFFFF;border-radius:20px;">
        <tr>
          <td style="padding:32px 24px 28px 24px;font-family:Helvetica,Arial,sans-serif;">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E17A47;border-radius:10px;">
              <tr>
                <td align="center" style="padding:14px 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;line-height:20px;">
                  &#10003;&nbsp;&nbsp;${bannerText}
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:26px 4px 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:22px;line-height:30px;font-weight:bold;color:#1A1A1A;">
                  ${headline}
                </td>
              </tr>
            </table>

            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 4px auto;">
              <tr>
                <td width="10" style="width:10px;font-size:0;line-height:0;"><div style="width:10px;height:10px;background-color:#F0B48E;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div></td>
                <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="10" style="width:10px;font-size:0;line-height:0;"><div style="width:10px;height:10px;background-color:#E17A47;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div></td>
                <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="10" style="width:10px;font-size:0;line-height:0;"><div style="width:10px;height:10px;background-color:#F0B48E;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div></td>
              </tr>
            </table>
${cardRows}

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#EEF9F2;border-radius:14px;margin-top:20px;table-layout:fixed;">
              <tr>
                <td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
                    <tr>
                      <td width="34" valign="top" style="width:34px;">
                        <div style="width:30px;height:30px;background-color:#22A45D;border-radius:15px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:30px;color:#FFFFFF;">&#10003;</div>
                      </td>
                      <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
                      <td valign="top" style="font-family:Helvetica,Arial,sans-serif;">${greenBox}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
${featuresStrip}

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
              <tr><td style="font-size:0;line-height:0;padding:0;"><div style="height:1px;background-color:#ECECEC;font-size:0;line-height:0;">&nbsp;</div></td></tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:20px 8px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;font-weight:bold;color:#1A1A1A;">
                  ${footerMain}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:8px 8px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#9A9A9A;">
                  Keep an eye on your phone.
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
}

/**
 * Queues a Trigger Email extension document for the customer when a job is accepted.
 * Same `mail` collection path as job-posted emails — no schema change.
 * Pass `position` + `acceptedSoFar` for designed stagger variants; omit for plain body.
 */
export async function queueJobAcceptedEmail(
  params: JobAcceptedEmailParams,
): Promise<void> {
  const customerEmail = normalizeCustomerEmail(params.to);

  console.log('[queueJobAcceptedEmail] Resolved recipient:', {
    input: params.to,
    to: customerEmail,
  });

  if (!customerEmail) {
    console.warn(
      '[queueJobAcceptedEmail] No valid customer email — skipping job accepted notification.',
    );
    return;
  }

  const position = params.position;
  const useDesigned =
    position === 1 || position === 2 || position === 3;

  let html: string;
  if (useDesigned) {
    const firstName =
      params.formData.fullName.trim().split(/\s+/)[0] || 'there';
    const tradeLabel = labelsFromJobType(currentJobType).category;
    html = buildStaggerAcceptedEmailHtml({
      firstName,
      tradeLabel,
      position,
      acceptedSoFar: params.acceptedSoFar ?? [],
    });
  } else {
    const details = await resolveAcceptorDetails(params.acceptor);
    html = `
      <p>Good news! A business has accepted your job request.</p>
      <p><strong>Business details:</strong></p>
      <ul>
        <li><strong>Business Name:</strong> ${escapeHtml(details.businessName)}</li>
        <li><strong>Phone Number:</strong> ${escapeHtml(details.phone)}</li>
        <li><strong>Email Address:</strong> ${escapeHtml(details.email)}</li>
      </ul>
      <p>Please open the app to view their details and chat.</p>
    `;
  }

  const mailDocument = {
    to: customerEmail,
    message: {
      subject: 'A Business Has Accepted Your Job!',
      html,
    },
  };

  console.log('[queueJobAcceptedEmail] Writing mail document to Firestore:', {
    to: mailDocument.to,
    subject: mailDocument.message.subject,
    position: useDesigned ? position : undefined,
  });

  const mailRef = collection(db, MAIL_COLLECTION);
  await addDoc(mailRef, mailDocument);
}

export interface JobPostedCustomerEmailParams {
  to: string;
  formData: WizardFormData;
}

/**
 * Queues a Trigger Email extension document for the customer when a job is posted.
 * Same `mail` collection path as other emails — no schema change.
 */
export async function queueJobPostedCustomerEmail(
  params: JobPostedCustomerEmailParams,
): Promise<void> {
  const customerEmail = normalizeCustomerEmail(params.to);

  if (!customerEmail) {
    console.warn(
      '[queueJobPostedCustomerEmail] No valid customer email — skipping job posted confirmation.',
    );
    return;
  }

  const firstName =
    params.formData.fullName.trim().split(/\s+/)[0] || 'there';
  const tradeLabel = labelsFromJobType(currentJobType).category;

  const mailDocument = {
    to: customerEmail,
    message: {
      subject: `Your ${tradeLabel} Job Has Been Posted`,
      html: `
<!--
  Job Posted — email template
  Placeholders: {{firstName}}  {{tradeLabel}}
  Brand orange: #E17A47  (swap everywhere if your brand token differs)
-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;margin:0;padding:24px 12px;">
  <tr>
    <td align="center">

      <!-- CARD -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background-color:#FFFFFF;border-radius:20px;">
        <tr>
          <td style="padding:32px 28px 28px 28px;font-family:Helvetica,Arial,sans-serif;">

            <!-- ORANGE BANNER -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E17A47;border-radius:10px;">
              <tr>
                <td align="center" style="padding:14px 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;line-height:20px;">
                  &#10003;&nbsp;&nbsp;Hi ${escapeHtml(firstName)}, your ${escapeHtml(tradeLabel)} Job has been posted
                </td>
              </tr>
            </table>

            <!-- HEADLINE -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:28px 8px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#1A1A1A;">
                  We're finding the best ${escapeHtml(tradeLabel)} contractors near you&hellip;
                </td>
              </tr>
            </table>

            <!-- ORANGE DOTS -->
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto 4px auto;">
              <tr>
                <td width="10" height="10" style="width:10px;height:10px;background-color:#F0B48E;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="10" height="10" style="width:10px;height:10px;background-color:#E17A47;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="10" height="10" style="width:10px;height:10px;background-color:#F0B48E;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>

            <!-- SKELETON CARD 1 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #F0F0F0;border-radius:14px;margin-top:20px;">
              <tr>
                <td style="padding:18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
                    <tr>
                      <td width="40" valign="top" style="width:40px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="36" height="36" style="width:36px;height:36px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="100%" valign="top" style="width:100%;">
                        <div style="height:10px;background-color:#EDEDED;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:12px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="26" valign="top" style="width:26px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="22" height="22" style="width:22px;height:22px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- SKELETON CARD 2 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #F0F0F0;border-radius:14px;margin-top:14px;">
              <tr>
                <td style="padding:18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
                    <tr>
                      <td width="40" valign="top" style="width:40px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="36" height="36" style="width:36px;height:36px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="100%" valign="top" style="width:100%;">
                        <div style="height:10px;background-color:#EDEDED;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:12px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="26" valign="top" style="width:26px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="22" height="22" style="width:22px;height:22px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- SKELETON CARD 3 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #F0F0F0;border-radius:14px;margin-top:14px;">
              <tr>
                <td style="padding:18px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
                    <tr>
                      <td width="40" valign="top" style="width:40px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="36" height="36" style="width:36px;height:36px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="100%" valign="top" style="width:100%;">
                        <div style="height:10px;background-color:#EDEDED;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:12px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="height:9px;background-color:#F1F1F1;border-radius:5px;font-size:0;line-height:0;">&nbsp;</div>
                      </td>
                      <td width="14" style="width:14px;font-size:0;">&nbsp;</td>
                      <td width="26" valign="top" style="width:26px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td width="22" height="22" style="width:22px;height:22px;background-color:#E9E9E9;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
                        </tr></table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- DIVIDER -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td height="1" style="height:1px;background-color:#ECECEC;font-size:0;line-height:0;padding:0;margin-top:24px;">&nbsp;</td>
              </tr>
            </table>

            <!-- FOOTER TEXT -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:24px 12px 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;font-weight:bold;color:#1A1A1A;">
                  Don't worry ${escapeHtml(firstName)} we're working hard to get you quotes as soon as we can.
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:10px 12px 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#9A9A9A;">
                  Keep an eye on your phone.
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
      <!-- /CARD -->

    </td>
  </tr>
</table>
`,
    },
  };

  const mailRef = collection(db, MAIL_COLLECTION);
  await addDoc(mailRef, mailDocument);
}

export interface JobPostedSmsParams {
  formData: WizardFormData;
  businesses: BusinessProfile[];
  options: {
    jobId: string;
    jobTitle?: string;
    customerLabel?: string;
    matchedBusinessIds?: string[];
  };
}

/**
 * Queues SMS documents for businesses when a job is posted.
 * Triggers the Cloud Function on `messages/{docId}`.
 */
export async function queueJobPostedSms(
  formData: WizardFormData,
  businesses: BusinessProfile[],
  options: JobPostedSmsParams['options'],
): Promise<void> {
  const businessesWithPhone = await resolveJobSmsRecipients(businesses, {
    matchedBusinessIds: options.matchedBusinessIds,
  });

  if (businessesWithPhone.length === 0) {
    console.warn(
      '[queueJobPostedSms] No business SMS recipients could be resolved.',
      { jobId: options.jobId, matchedBusinessIds: options.matchedBusinessIds },
    );
    return;
  }

  const userName = formData.fullName.trim();
  const { title, category } = labelsFromJobType(currentJobType);
  const jobTitle = options.jobTitle ?? title;
  const customerLabel = options.customerLabel ?? 'A new user';
  const locationData = formData.locationData;
  const suburb =
    locationData?.suburb?.trim() ||
    locationData?.displayLabel?.trim() ||
    formData.location.trim() ||
    'your area';

  console.log('[queueJobPostedSms] Queueing job notification SMS:', {
    jobId: options.jobId,
    recipients: businessesWithPhone.map((business) => business.phone),
  });

  await Promise.all(
    businessesWithPhone.map((business) => {
      const to = extractBusinessPhone(business);
      if (!to) return Promise.resolve();

      const body =
        'New Job Request Received\n\n' +
        `${customerLabel} has posted a new job on the platform. Here are the details:\n\n` +
        `Job ID: ${options.jobId}\n` +
        `User Name: ${userName}\n` +
        `Job Title: ${jobTitle}\n` +
        `Category: ${category}\n` +
        `Area/Location: ${locationData?.displayLabel?.trim() || formData.location.trim() || 'Not specified'}\n` +
        `Suburb: ${locationData?.suburb?.trim() || 'Not specified'}\n` +
        `Timeline: ${formData.timeline !== '' ? TIMELINE_LABELS[formData.timeline] : 'Not specified'}\n\n` +
        `Description:\n${formData.jobDescription.trim()}\n\n` +
        'Please open the Business App to accept or review this job.';

      return queueSmsDocument(to, body);
    }),
  );
}

export interface JobAcceptedSmsParams {
  formData: WizardFormData;
  acceptor: BusinessProfile;
  usersLeadDocId?: string;
  jobId?: string;
  jobTitle?: string;
}

/**
 * Queues an SMS document for the customer when a job is accepted.
 * Triggers the Cloud Function on `messages/{docId}`.
 */
export async function queueJobAcceptedSms(
  params: JobAcceptedSmsParams,
): Promise<void> {
  let customerPhone = normalizeSmsPhone(params.formData.phone);

  if (!customerPhone && params.usersLeadDocId) {
    customerPhone = await resolveCustomerPhoneForAcceptedJob({
      formData: params.formData,
      usersLeadDocId: params.usersLeadDocId,
      jobId: params.jobId,
    });
  }

  if (!customerPhone) {
    console.warn(
      '[queueJobAcceptedSms] No valid customer phone — skipping job accepted SMS.',
    );
    return;
  }

  const details = await resolveAcceptorDetails(params.acceptor);

  const body =
    'Good news! A business has accepted your job request.\n\n' +
    'Business details:\n' +
    `Business Name: ${details.businessName}\n` +
    `Phone Number: ${details.phone}\n` +
    `Email Address: ${details.email}\n\n` +
    'Please open the app to view their details and chat.';

  console.log('[queueJobAcceptedSms] Writing messages document to Firestore:', {
    to: customerPhone,
    businessName: details.businessName,
  });

  await queueSmsDocument(customerPhone, body);
}
