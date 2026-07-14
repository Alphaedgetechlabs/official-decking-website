export interface BusinessDocument {
  uid: string;
  type?: 'business';
  email: string;
  businessName: string;
  phone: string;
  countryCode?: string;
  phoneNormalized?: string;
  createdAt?: import('firebase/firestore').Timestamp;
  updatedAt?: import('firebase/firestore').Timestamp;
}
