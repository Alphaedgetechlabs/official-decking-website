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

/**
 * Resolves matched businesses for job routing via each business's custom radius.
 * A business only qualifies when the job is inside `business.serviceArea`.
 */
export async function resolveMatchedBusinessesForJob(
  locationData: StoredLocation,
): Promise<BusinessProfile[]> {
  const businessesRef = collection(db, BUSINESSES_COLLECTION);
  const snap = await getDocs(businessesRef);
  const businesses = snap.docs.map(mapDoc);
  const jobCoordinates: [number, number] = [
    locationData.latitude,
    locationData.longitude,
  ];

  const matched = businesses.filter((business) => {
    const serviceArea = parseBusinessServiceArea(business.serviceArea);
    if (!serviceArea) return false;

    const distanceInMeters =
      distanceBetween(jobCoordinates, [
        serviceArea.latitude,
        serviceArea.longitude,
      ]) * 1000;

    return distanceInMeters <= serviceArea.radiusMeters;
  });

  if (matched.length > 0) return matched;

  console.warn(
    '[business-match] No businesses matched custom service radius:',
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
