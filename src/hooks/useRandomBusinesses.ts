import { useEffect, useState } from 'react';
import {
  fetchRandomBusinesses,
  type BusinessProfile,
} from '../services/businessService';

export function useRandomBusinesses(count = 3) {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const results = await fetchRandomBusinesses(count);
        if (!cancelled) {
          setBusinesses(results);
        }
      } catch (err) {
        console.error('Failed to fetch random businesses:', err);
        if (!cancelled) {
          setError('Unable to load business profiles right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [count]);

  return { businesses, loading, error };
}
