export interface StoredLocation {
  placeId: string;
  name: string;
  formattedAddress: string;
  displayLabel: string;
  suburb: string;
  state: string;
  stateFullName: string;
  postcode: string;
  country: string;
  countryName: string;
  latitude: number;
  longitude: number;
  placeTypes: string[];
}

export const EMPTY_STORED_LOCATION: StoredLocation = {
  placeId: '',
  name: '',
  formattedAddress: '',
  displayLabel: '',
  suburb: '',
  state: '',
  stateFullName: '',
  postcode: '',
  country: '',
  countryName: '',
  latitude: 0,
  longitude: 0,
  placeTypes: [],
};
