import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { distanceBetween } from 'geofire-common';
import { db } from '../firebase';
import type { StoredLocation } from '../types/location';
import type { BusinessDocument, BusinessServiceArea } from '../types/business';

const BUSINESSES_COLLECTION = 'businesses';

export interface BusinessProfile extends BusinessDocument {
  id: string;
}

export function normalizeSuburbKey(suburb: string): string {
  return suburb.trim().toLowerCase();
}

function dedupeBusinessProfiles(businesses: BusinessProfile[]): BusinessProfile[] {
  const byId = new Map<string, BusinessProfile>();
  for (const business of businesses) {
    byId.set(business.id, business);
  }
  return [...byId.values()];
}

function filterBusinessesByState(
  businesses: BusinessProfile[],
  state?: string,
): BusinessProfile[] {
  if (!state?.trim()) return businesses;

  const normalizedState = state.trim().toUpperCase();
  const filtered = businesses.filter((business) => {
    const businessState = business.state?.trim().toUpperCase();
    return !businessState || businessState === normalizedState;
  });

  return filtered.length > 0 ? filtered : businesses;
}

async function queryBusinessesBySuburbField(
  field: 'serviceSuburbs' | 'suburbs',
  suburbValue: string,
): Promise<BusinessProfile[]> {
  const businessesRef = collection(db, BUSINESSES_COLLECTION);
  const snap = await getDocs(
    query(businessesRef, where(field, 'array-contains', suburbValue)),
  );
  return snap.docs.map(mapDoc);
}

/**
 * Returns businesses whose coverage includes the job suburb.
 * Tries common Firestore field shapes and deduplicates results.
 */
export async function fetchBusinessesBySuburb(
  suburb: string,
  state?: string,
): Promise<BusinessProfile[]> {
  const trimmedSuburb = suburb.trim();
  if (!trimmedSuburb) return [];

  const suburbCandidates = [
    normalizeSuburbKey(trimmedSuburb),
    trimmedSuburb,
    trimmedSuburb
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' '),
  ].filter((value, index, values) => values.indexOf(value) === index);

  const collected: BusinessProfile[] = [];

  for (const candidate of suburbCandidates) {
    for (const field of ['serviceSuburbs', 'suburbs'] as const) {
      try {
        collected.push(...(await queryBusinessesBySuburbField(field, candidate)));
      } catch (err) {
        console.warn(
          `[business-match] Failed to query businesses.${field} for "${candidate}":`,
          err,
        );
      }
    }
  }

  try {
    const businessesRef = collection(db, BUSINESSES_COLLECTION);
    for (const candidate of suburbCandidates) {
      const byLocationSuburb = await getDocs(
        query(
          businessesRef,
          where('locationData.suburb', '==', candidate),
        ),
      );
      collected.push(...byLocationSuburb.docs.map(mapDoc));
    }
  } catch (err) {
    console.warn('[business-match] Failed to query businesses.locationData.suburb:', err);
  }

  return filterBusinessesByState(dedupeBusinessProfiles(collected), state);
}

const EXPANSION_RADII_METERS = [50_000, 100_000, 200_000] as const;
const EXPANSION_MATCH_CAP = 3;

/** Reject null-island / missing coords that would poison Haversine matching. */
function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

function distanceFromJobMeters(
  jobCoordinates: [number, number],
  serviceArea: { latitude: number; longitude: number },
): number {
  return (
    distanceBetween(jobCoordinates, [
      serviceArea.latitude,
      serviceArea.longitude,
    ]) * 1000
  );
}

function logMatchStep(
  step: string,
  matches: { business: BusinessProfile; distanceInMeters: number }[],
): void {
  console.log(
    `[business-match] ${step}: ${matches.length} match(es)`,
    matches.map(({ business, distanceInMeters }) => ({
      id: business.id,
      businessName: business.businessName,
      distanceKm: Math.round((distanceInMeters / 1000) * 10) / 10,
    })),
  );
}

/**
 * Resolves matched businesses for job routing via each business's custom radius.
 * A business only qualifies when the job is inside `business.serviceArea`.
 * If none cover the job, expands to nearest businesses within 50 → 100 → 200 km
 * (ignoring their radius). Never falls back to random.
 */
export async function resolveMatchedBusinessesForJob(
  locationData: StoredLocation,
): Promise<BusinessProfile[]> {
  const jobCoordinates: [number, number] = [
    locationData.latitude,
    locationData.longitude,
  ];

  if (!isValidCoordinates(jobCoordinates[0], jobCoordinates[1])) {
    console.error(
      '[business-match] Invalid job coordinates; skipping match and fallback:',
      {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      },
    );
    return [];
  }

  const businessesRef = collection(db, BUSINESSES_COLLECTION);
  const snap = await getDocs(businessesRef);
  const businesses = snap.docs.map(mapDoc);

  // Step 1: job inside business.serviceArea (unchanged coverage rule).
  const step1Matches: { business: BusinessProfile; distanceInMeters: number }[] =
    [];
  for (const business of businesses) {
    const serviceArea = parseBusinessServiceArea(business.serviceArea);
    if (!serviceArea) continue;
    if (!isValidCoordinates(serviceArea.latitude, serviceArea.longitude)) {
      continue;
    }

    const distanceInMeters = distanceFromJobMeters(jobCoordinates, serviceArea);
    if (distanceInMeters <= serviceArea.radiusMeters) {
      step1Matches.push({ business, distanceInMeters });
    }
  }

  if (step1Matches.length > 0) {
    logMatchStep('Step 1 (serviceArea covers job)', step1Matches);
    return step1Matches.map(({ business }) => business);
  }

  console.warn(
    '[business-match] No businesses matched custom service radius; trying expansion:',
    {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    },
  );

  // Steps 2–4: nearest businesses within expanding rings (ignore their radius).
  for (const radiusMeters of EXPANSION_RADII_METERS) {
    const radiusKm = radiusMeters / 1000;
    const withinRing: { business: BusinessProfile; distanceInMeters: number }[] =
      [];

    for (const business of businesses) {
      const serviceArea = parseBusinessServiceArea(business.serviceArea);
      if (!serviceArea) continue;
      if (!isValidCoordinates(serviceArea.latitude, serviceArea.longitude)) {
        continue;
      }

      const distanceInMeters = distanceFromJobMeters(
        jobCoordinates,
        serviceArea,
      );
      if (distanceInMeters <= radiusMeters) {
        withinRing.push({ business, distanceInMeters });
      }
    }

    withinRing.sort((a, b) => a.distanceInMeters - b.distanceInMeters);
    const capped = withinRing.slice(0, EXPANSION_MATCH_CAP);

    if (capped.length > 0) {
      const stepLabel =
        radiusKm === 50
          ? 'Step 2 (within 50 km)'
          : radiusKm === 100
            ? 'Step 3 (within 100 km)'
            : 'Step 4 (within 200 km)';
      logMatchStep(stepLabel, capped);
      return capped.map(({ business }) => business);
    }
  }

  console.warn(
    '[business-match] Step 5: no businesses within 200 km; returning empty list',
    {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    },
  );
  return [];
}

function parseBusinessServiceArea(
  serviceArea: BusinessServiceArea | undefined,
): { latitude: number; longitude: number; radiusMeters: number } | null {
  if (!serviceArea) return null;

  const latitude =
    typeof serviceArea.latitude === 'number'
      ? serviceArea.latitude
      : typeof serviceArea.geopoint?.latitude === 'number'
        ? serviceArea.geopoint.latitude
        : typeof serviceArea.center?.latitude === 'number'
          ? serviceArea.center.latitude
          : null;
  const longitude =
    typeof serviceArea.longitude === 'number'
      ? serviceArea.longitude
      : typeof serviceArea.geopoint?.longitude === 'number'
        ? serviceArea.geopoint.longitude
        : typeof serviceArea.center?.longitude === 'number'
          ? serviceArea.center.longitude
          : null;
  const radiusMeters =
    typeof serviceArea.radiusMeters === 'number'
      ? serviceArea.radiusMeters
      : null;

  if (
    latitude == null ||
    longitude == null ||
    radiusMeters == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 0
  ) {
    return null;
  }

  return { latitude, longitude, radiusMeters };
}

function mapDoc(snapshot: QueryDocumentSnapshot): BusinessProfile {
  return {
    id: snapshot.id,
    ...(snapshot.data() as BusinessDocument),
  };
}

/**
 * Fetches `count` random business profiles without reading the entire collection.
 * Uses a random document ID as a cursor, then wraps from the start if needed.
 */
export async function fetchRandomBusinesses(
  count = 3,
): Promise<BusinessProfile[]> {
  if (count <= 0) return [];

  const businessesRef = collection(db, BUSINESSES_COLLECTION);
  const randomId = doc(businessesRef).id;

  const primaryQuery = query(
    businessesRef,
    orderBy(documentId()),
    startAt(randomId),
    limit(count),
  );

  const primarySnap = await getDocs(primaryQuery);
  const results = primarySnap.docs.map(mapDoc);

  if (results.length >= count) {
    return results.slice(0, count);
  }

  const remaining = count - results.length;
  const existingIds = new Set(results.map((b) => b.id));

  const fallbackQuery = query(
    businessesRef,
    orderBy(documentId()),
    limit(remaining + existingIds.size),
  );

  const fallbackSnap = await getDocs(fallbackQuery);

  for (const snapshot of fallbackSnap.docs) {
    if (results.length >= count) break;
    if (!existingIds.has(snapshot.id)) {
      results.push(mapDoc(snapshot));
      existingIds.add(snapshot.id);
    }
  }

  return results.slice(0, count);
}

export async function fetchBusinessesByIds(
  ids: string[],
): Promise<BusinessProfile[]> {
  if (ids.length === 0) return [];

  const uniqueIds = [...new Set(ids)];
  const businessesRef = collection(db, BUSINESSES_COLLECTION);
  const snap = await getDocs(
    query(businessesRef, where(documentId(), 'in', uniqueIds)),
  );

  const byId = new Map(snap.docs.map((snapshot) => [snapshot.id, mapDoc(snapshot)]));

  return ids
    .map((id) => byId.get(id))
    .filter((business): business is BusinessProfile => business != null);
}

export async function fetchBusinessById(
  businessId: string,
): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, BUSINESSES_COLLECTION, businessId));
  if (!snap.exists()) return null;
  return mapDocFromSnap(snap);
}

function mapDocFromSnap(snapshot: DocumentSnapshot): BusinessProfile {
  return {
    id: snapshot.id,
    ...(snapshot.data() as BusinessDocument),
  };
}
