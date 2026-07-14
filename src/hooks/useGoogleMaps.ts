import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useEffect, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsApiKey } from '../config/googleMaps';

let loadPromise: Promise<void> | null = null;
let loadError: string | null = null;

function loadGoogleMaps(): Promise<void> {
  if (!hasGoogleMapsApiKey) {
    return Promise.reject(
      new Error(
        'Missing VITE_GOOGLE_MAPS_API_KEY. Add a Google Maps API key to your .env file.',
      ),
    );
  }

  if (loadError) {
    return Promise.reject(new Error(loadError));
  }

  if (!loadPromise) {
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: 'weekly',
    });

    loadPromise = importLibrary('places')
      .then(() => undefined)
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load Google Places library';
        loadError = message;
        loadPromise = null;
        console.error('[Google Maps] Places library failed to load:', err);
        throw new Error(message);
      });
  }

  return loadPromise;
}

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!hasGoogleMapsApiKey) {
      setError(
        'Location search is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.',
      );
      return;
    }

    loadGoogleMaps()
      .then(() => {
        if (!cancelled) {
          setIsLoaded(true);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : 'Location search is temporarily unavailable. Please refresh and try again.';
          setError(message);
          setIsLoaded(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isLoaded, error, hasApiKey: hasGoogleMapsApiKey };
}
