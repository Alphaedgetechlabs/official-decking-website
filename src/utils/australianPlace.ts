import type { StoredLocation } from '../types/location';

const AUSTRALIAN_STATES = new Set([
  'NSW',
  'VIC',
  'QLD',
  'SA',
  'WA',
  'TAS',
  'NT',
  'ACT',
]);

const SUBURB_TYPES = [
  'locality',
  'postal_town',
  'sublocality_level_1',
  'sublocality',
  'neighborhood',
] as const;

function getComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  nameType: 'long_name' | 'short_name' = 'long_name',
): string {
  const match = components.find((component) => component.types.includes(type));
  return match?.[nameType]?.trim() ?? '';
}

function getSuburb(components: google.maps.GeocoderAddressComponent[]): string {
  for (const type of SUBURB_TYPES) {
    const value = getComponent(components, type);
    if (value) return value;
  }
  return '';
}

function formatAustralianPostcode(value: string): string {
  const digits = value.replace(/\D/g, '');
  return /^\d{4}$/.test(digits) ? digits : value.trim();
}

function formatAustralianDisplayLabel(parts: {
  suburb: string;
  state: string;
  postcode: string;
  name: string;
}): string {
  const suburb = parts.suburb || parts.name;
  const state = parts.state.toUpperCase();
  const postcode = formatAustralianPostcode(parts.postcode);

  if (suburb && state && postcode) {
    return `${suburb}, ${state} ${postcode}`;
  }
  if (suburb && state) {
    return `${suburb}, ${state}`;
  }
  if (postcode && state) {
    return `${postcode}, ${state}`;
  }
  if (suburb && postcode) {
    return `${suburb} ${postcode}`;
  }
  if (suburb) {
    return suburb;
  }
  if (postcode) {
    return postcode;
  }

  return parts.name.trim();
}

function cleanFormattedAddress(address: string): string {
  return address.replace(/, Australia$/i, '').trim();
}

export function parseAustralianPlace(
  place: google.maps.places.PlaceResult,
): StoredLocation | null {
  if (!place.place_id || !place.address_components?.length) {
    return null;
  }

  const components = place.address_components;
  const country = getComponent(components, 'country', 'short_name').toUpperCase();

  if (country !== 'AU') {
    return null;
  }

  const suburb = getSuburb(components);
  const state = getComponent(
    components,
    'administrative_area_level_1',
    'short_name',
  ).toUpperCase();
  const stateFullName = getComponent(
    components,
    'administrative_area_level_1',
    'long_name',
  );
  const postcode = formatAustralianPostcode(
    getComponent(components, 'postal_code'),
  );
  const countryName = getComponent(components, 'country', 'long_name');
  const name = place.name?.trim() ?? suburb ?? postcode;
  const formattedAddress = cleanFormattedAddress(place.formatted_address ?? '');
  const latitude = place.geometry?.location?.lat() ?? 0;
  const longitude = place.geometry?.location?.lng() ?? 0;
  const placeTypes = place.types ?? [];

  if (!suburb && !postcode) {
    return null;
  }

  if (state && !AUSTRALIAN_STATES.has(state)) {
    return null;
  }

  if (postcode && !/^\d{4}$/.test(postcode)) {
    return null;
  }

  const displayLabel = formatAustralianDisplayLabel({
    suburb,
    state,
    postcode,
    name,
  });

  if (!displayLabel) {
    return null;
  }

  return {
    placeId: place.place_id,
    name,
    formattedAddress: formattedAddress || displayLabel,
    displayLabel,
    suburb,
    state,
    stateFullName,
    postcode,
    country,
    countryName: countryName || 'Australia',
    latitude,
    longitude,
    placeTypes,
  };
}

export function isLocationValidated(locationData: StoredLocation | null): boolean {
  return Boolean(
    locationData?.placeId &&
      locationData.country === 'AU' &&
      (locationData.suburb || locationData.postcode),
  );
}

/** Build a StoredLocation from the static suburbs dataset (fallback when Google Places is unavailable). */
export function suburbToStoredLocation(suburb: {
  name: string;
  state: string;
  postcode: string;
}): StoredLocation {
  const displayLabel = `${suburb.name}, ${suburb.state}, ${suburb.postcode}`;
  return {
    placeId: `static:${suburb.name}:${suburb.state}:${suburb.postcode}`,
    name: suburb.name,
    formattedAddress: displayLabel,
    displayLabel,
    suburb: suburb.name,
    state: suburb.state,
    stateFullName: suburb.state,
    postcode: suburb.postcode,
    country: 'AU',
    countryName: 'Australia',
    latitude: 0,
    longitude: 0,
    placeTypes: ['locality'],
  };
}

export function toLocationFormUpdate(
  locationData: StoredLocation | null,
): { location: string; locationData: StoredLocation | null } {
  if (!locationData) {
    return { location: '', locationData: null };
  }

  return {
    location: locationData.displayLabel,
    locationData,
  };
}
