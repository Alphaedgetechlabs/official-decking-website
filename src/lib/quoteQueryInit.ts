import { AUSTRALIAN_SUBURBS, TIMELINE_OPTIONS, type Suburb } from '@/data/formData';
import type { StoredLocation } from '@/types/location';
import { suburbToStoredLocation } from '@/utils/australianPlace';
import { sanitizeQueryValue } from '@/utils/sanitizeQueryValue';

export type QuoteFormStep =
  | 'location'
  | 'timeline'
  | 'description'
  | 'contact'
  | 'matching';

export interface QuoteQueryInit {
  location: string;
  timeline: string;
  description: string;
  name: string;
  email: string;
  phone: string;
  suburb: Suburb | null;
  locationData: StoredLocation | null;
  step: QuoteFormStep;
}

const TIMELINE_LABELS = new Set(TIMELINE_OPTIONS.map((o) => o.label));

function matchSuburb(locationQuery: string): Suburb | null {
  const q = locationQuery.trim();
  if (!q) return null;

  const structured = q.match(/^(.+?),\s*([A-Za-z]{2,3})[,\s]+(\d{4})$/);
  if (structured) {
    const name = structured[1].trim().toLowerCase();
    const state = structured[2].toUpperCase();
    const postcode = structured[3];
    return (
      AUSTRALIAN_SUBURBS.find(
        (s) =>
          s.name.toLowerCase() === name &&
          s.state === state &&
          s.postcode === postcode,
      ) ?? null
    );
  }

  if (/^\d{4}$/.test(q)) {
    const matches = AUSTRALIAN_SUBURBS.filter((s) => s.postcode === q);
    return matches.length === 1 ? matches[0] : null;
  }

  const byName = AUSTRALIAN_SUBURBS.filter(
    (s) => s.name.toLowerCase() === q.toLowerCase(),
  );
  return byName.length === 1 ? byName[0] : null;
}

function resolveInitialStep(fields: {
  location: string;
  timeline: string;
  description: string;
}): QuoteFormStep {
  const hasLocation = fields.location.length > 0;
  const hasTimeline = fields.timeline.length > 0;
  const hasDescription = fields.description.length > 0;

  if (hasLocation && hasTimeline && hasDescription) return 'contact';
  if (hasLocation && hasTimeline) return 'description';
  if (hasLocation) return 'timeline';
  return 'location';
}

/** Read, sanitize, and map quote URL query params; compute the starting step. */
export function parseQuoteQueryInit(
  searchParams: URLSearchParams,
): QuoteQueryInit {
  const location = sanitizeQueryValue(searchParams.get('location') ?? '').trim();
  const rawTimeline = sanitizeQueryValue(searchParams.get('timeline') ?? '').trim();
  const timeline = TIMELINE_LABELS.has(rawTimeline) ? rawTimeline : '';
  const description = sanitizeQueryValue(
    searchParams.get('description') ?? '',
  ).trim();
  const name = sanitizeQueryValue(searchParams.get('name') ?? '').trim();
  const email = sanitizeQueryValue(searchParams.get('email') ?? '').trim();
  const phone = sanitizeQueryValue(searchParams.get('phone') ?? '').trim();

  const suburb = location ? matchSuburb(location) : null;
  const locationData = suburb ? suburbToStoredLocation(suburb) : null;

  return {
    location,
    timeline,
    description,
    name,
    email,
    phone,
    suburb,
    locationData,
    step: resolveInitialStep({ location, timeline, description }),
  };
}

if (import.meta.env.DEV) {
  const all = parseQuoteQueryInit(
    new URLSearchParams(
      'location=Adelaide&timeline=ASAP — Urgent job&description=New fence',
    ),
  );
  console.assert(all.step === 'contact', 'all three params → contact (step 4)');

  const locOnly = parseQuoteQueryInit(new URLSearchParams('location=Adelaide'));
  console.assert(locOnly.step === 'timeline', 'location only → timeline (step 2)');

  const none = parseQuoteQueryInit(new URLSearchParams(''));
  console.assert(none.step === 'location', 'no params → location (step 1)');

  const xss = parseQuoteQueryInit(
    new URLSearchParams('description=<img src=x onerror=alert(1)>'),
  );
  console.assert(
    !xss.description.includes('<'),
    'description must be sanitized before use',
  );
}
