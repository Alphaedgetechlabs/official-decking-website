/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Comma-separated Firestore `businesses` document IDs for temporary auto-accept. */
  readonly VITE_AUTO_ACCEPT_BUSINESS_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}