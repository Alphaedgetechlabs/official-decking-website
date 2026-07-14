import type { StoredLocation } from "@/types/location";
import type { TimelineOption, UploadedFile, WizardFormData } from "@/types/wizard";

const TIMELINE_LABEL_MAP: Record<string, TimelineOption> = {
  "ASAP — Urgent job": "asap",
  "Within 2 weeks — Ready to book soon": "within-2-weeks",
  "In a month — Planning ahead": "in-a-month",
  "Just comparing quotes — No pressure": "comparing",
};

export function mapTimelineLabel(label: string): TimelineOption | "" {
  return TIMELINE_LABEL_MAP[label] ?? "";
}

export function buildWizardFormData(params: {
  locationData: StoredLocation;
  timelineLabel: string;
  jobDescription: string;
  photos: File[];
  fullName: string;
  email: string;
  phone: string;
}): WizardFormData {
  const photos: UploadedFile[] = params.photos.map((file) => ({
    file,
    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
  }));

  return {
    location: params.locationData.displayLabel,
    locationData: params.locationData,
    timeline: mapTimelineLabel(params.timelineLabel),
    jobDescription: params.jobDescription,
    photos,
    fullName: params.fullName,
    email: params.email,
    phone: params.phone,
  };
}
