export interface BusinessLocationData {
  suburb?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  geohash?: string;
}

export interface BusinessServiceArea {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  geopoint?: {
    latitude?: number;
    longitude?: number;
  };
  center?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface BusinessDocument {
  uid: string;
  type?: 'business';
  email: string;
  businessName: string;
  phone: string;
  countryCode?: string;
  phoneNormalized?: string;
  /** Suburbs this business serves — used for job routing queries. */
  serviceSuburbs?: string[];
  /** Alternate suburb coverage field used by some business profiles. */
  suburbs?: string[];
  locationData?: BusinessLocationData;
  serviceArea?: BusinessServiceArea;
  state?: string;
  isAutoAcceptEnabled?: boolean;
  /** e.g. 'fencing', 'retaining-wall', 'Both' */
  services_provided?: string[];
  /** Average star rating from the business profile. */
  rating?: number;
  /** Total review count from the business profile. */
  reviewCount?: number;
  /** Business profile description / about text. */
  description?: string;
  createdAt?: import('firebase/firestore').Timestamp;
  updatedAt?: import('firebase/firestore').Timestamp;
}
