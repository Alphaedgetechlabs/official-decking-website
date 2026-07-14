import type { StoredLocation } from './location';
import type { TimelineOption } from './wizard';

export interface UserDocument {
  type?: 'user';
  fullName: string;
  email: string;
  phone: string;
  location: string;
  locationData?: StoredLocation;
  phoneNormalized?: string;
  photoUrls?: string[];
  isVerified?: boolean;
  uid?: string;
  timeline?: TimelineOption | string;
  jobDescription?: string;
  matchedBusinessIds?: string[];
  createdAt?: { toDate?: () => Date };
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}
