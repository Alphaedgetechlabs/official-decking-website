// Minimal ambient declarations for the small slice of the Google Maps
// JavaScript API this app uses. Declared locally so typechecking never depends
// on the @types/google.maps package being present in the build environment.
declare namespace google.maps {
  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface LatLngBounds {
    contains(latLng: LatLng): boolean;
  }

  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  interface MapsEventListener {
    remove(): void;
  }

  namespace event {
    function removeListener(listener: MapsEventListener): void;
    function clearInstanceListeners(instance: object): void;
    function addListener(
      instance: object,
      eventName: string,
      handler: (...args: unknown[]) => void,
    ): MapsEventListener;
  }

  namespace places {
    interface PlaceGeometry {
      location?: LatLng;
      viewport?: LatLngBounds;
    }

    interface PlaceResult {
      address_components?: GeocoderAddressComponent[];
      formatted_address?: string;
      geometry?: PlaceGeometry;
      name?: string;
      place_id?: string;
      types?: string[];
    }

    interface AutocompleteOptions {
      componentRestrictions?: { country: string | string[] };
      fields?: string[];
      types?: string[];
      bounds?: unknown;
      strictBounds?: boolean;
    }

    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
      addListener(eventName: string, handler: () => void): MapsEventListener;
      getPlace(): PlaceResult;
      setFields(fields: string[]): void;
      setOptions(options: AutocompleteOptions): void;
    }
  }
}

declare const google: typeof globalThis extends { google: infer G } ? G : typeof google;
