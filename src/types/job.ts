import type { StoredLocation } from './location';
import type { TimelineOption } from './wizard';

export type JobStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface JobDocument {
  userId: string;
  uid: string;
  title: string;
  category: string;
  status: JobStatus;
  location: string;
  locationData: StoredLocation;
  timeline: TimelineOption;
  jobDescription: string;
  photoUrls: string[];
  photoCount: number;
  fullName: string;
  email: string;
  phone: string;
}
