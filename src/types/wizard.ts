import type { StoredLocation } from './location';

export type TimelineOption =
  | 'asap'
  | 'within-2-weeks'
  | 'in-a-month'
  | 'comparing';

export interface UploadedFile {
  file: File;
  preview: string;
}

export interface WizardFormData {
  location: string;
  locationData: StoredLocation | null;
  timeline: TimelineOption | '';
  jobDescription: string;
  photos: UploadedFile[];
  fullName: string;
  email: string;
  phone: string;
}

export const MAX_PHOTOS = 5;

export const INITIAL_FORM_DATA: WizardFormData = {
  location: '',
  locationData: null,
  timeline: '',
  jobDescription: '',
  photos: [],
  fullName: '',
  email: '',
  phone: '',
};
