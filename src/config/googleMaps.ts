import { firebaseConfig } from '../firebase';

const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/** Dedicated Maps key — never fall back to Firebase key (Places API won't work). */
export const GOOGLE_MAPS_API_KEY = envKey?.trim() || '';

export const hasGoogleMapsApiKey = GOOGLE_MAPS_API_KEY.length > 0;

/** @deprecated Firebase API key is not valid for Places Autocomplete */
export const firebaseApiKey = firebaseConfig.apiKey;

