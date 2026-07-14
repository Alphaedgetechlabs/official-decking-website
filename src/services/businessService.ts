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
import { db } from '../firebase';
import type { BusinessDocument } from '../types/business';

const BUSINESSES_COLLECTION = 'businesses';

export interface BusinessProfile extends BusinessDocument {
  id: string;
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
