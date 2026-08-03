import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AustraliaLocationAutocomplete } from "@/components/wizard/AustraliaLocationAutocomplete";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import type { StoredLocation } from "@/types/location";
import { isLocationValidated, suburbToStoredLocation } from "@/utils/australianPlace";
import { sanitizeQueryValue } from "@/utils/sanitizeQueryValue";
import { AUSTRALIAN_SUBURBS, Suburb } from "@/data/formData";
import { MapPin, Clock, ArrowRight, Zap } from "lucide-react";

interface LocationStepProps {
  trade: string;
  onNext: (suburb: Suburb, locationData: StoredLocation) => void;
}

const LOCATION_INPUT_CLASS =
  "w-full border-2 border-brand-orange rounded-xl p-4 text-lg focus:ring-brand-orange focus:border-brand-orange focus:outline-none bg-card text-foreground";

function toSuburb(location: StoredLocation): Suburb {
  return {
    name: location.suburb || location.name,
    state: location.state,
    postcode: location.postcode,
  };
}

function StaticSuburbInput({
  query,
  onQueryChange,
  selectedSuburb,
  onSelect,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  selectedSuburb: Suburb | null;
  onSelect: (suburb: Suburb) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return AUSTRALIAN_SUBURBS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.postcode.includes(q) ||
        s.state.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  return (
    <>
      <input
        className={LOCATION_INPUT_CLASS}
        id="postcode"
        placeholder="Enter postcode or suburb"
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => query.trim() && setShowDropdown(true)}
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((suburb, i) => (
            <button
              key={`${suburb.name}-${suburb.state}-${i}`}
              type="button"
              onClick={() => {
                onSelect(suburb);
                onQueryChange(`${suburb.name}, ${suburb.state}, ${suburb.postcode}`);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-orange-light transition-colors text-left"
            >
              <MapPin className="h-4 w-4 text-brand-orange/60 flex-shrink-0" />
              <span className="text-foreground">
                {suburb.name}, {suburb.state}, {suburb.postcode}
              </span>
            </button>
          ))}
        </div>
      )}
      {!selectedSuburb && query.trim() && filtered.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No suburbs found. Try a different spelling or postcode.
        </p>
      )}
    </>
  );
}

const LocationStep = ({ trade, onNext }: LocationStepProps) => {
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const useGooglePlaces = isLoaded && !mapsError;

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() =>
    sanitizeQueryValue(searchParams.get("location") ?? ""),
  );
  const [locationData, setLocationData] = useState<StoredLocation | null>(null);
  const [staticSuburb, setStaticSuburb] = useState<Suburb | null>(null);

  // URL → input (deep link / refresh / new tab)
  useEffect(() => {
    const locationParam = sanitizeQueryValue(searchParams.get("location") ?? "");
    setQuery((prev) => (prev === locationParam ? prev : locationParam));
  }, [searchParams]);

  // input → URL
  useEffect(() => {
    const locationParam = sanitizeQueryValue(searchParams.get("location") ?? "");
    if (query === locationParam) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (query) next.set("location", query);
        else next.delete("location");
        return next;
      },
      { replace: true },
    );
  }, [query, searchParams, setSearchParams]);

  const tradeLower = trade.toLowerCase();

  const resolvedLocation = !useGooglePlaces && staticSuburb
    ? suburbToStoredLocation(staticSuburb)
    : locationData;

  const isValid = isLocationValidated(resolvedLocation);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-muted">
      <main className="bg-card rounded-2xl shadow-xl w-full max-w-[640px] p-10 md:p-14">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Clock className="h-4 w-4" />
            <span>Step 1 of 5</span>
          </div>
          <div className="flex-1 mx-4 h-2 bg-brand-orange-light rounded-full overflow-hidden">
            <div className="bg-brand-orange h-full w-1/5 rounded-full"></div>
          </div>
          <div className="text-brand-orange text-sm font-semibold">20% Complete</div>
        </header>

        <section>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-6">
            Where's the job located?
          </h1>

          <div className="flex items-start gap-3 mb-8">
            <div className="mt-1">
              <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="9" stroke="hsl(var(--brand-orange))" strokeWidth="2" />
                <path d="M6 10L9 13L14 7" stroke="hsl(var(--brand-orange))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <p className="text-muted-foreground text-lg">
              We'll instantly match you with <span className="text-brand-orange font-semibold">verified local {tradeLower} pros</span> who are available right now.
            </p>
          </div>

          <div className="mb-8 relative">
            <label className="flex items-center gap-2 text-foreground font-bold mb-3" htmlFor="postcode">
              <MapPin className="h-5 w-5" />
              Postcode or Suburb
            </label>

            {!useGooglePlaces ? (
              <StaticSuburbInput
                query={query}
                onQueryChange={(q) => {
                  setQuery(q);
                  setStaticSuburb(null);
                }}
                selectedSuburb={staticSuburb}
                onSelect={setStaticSuburb}
              />
            ) : (
              <AustraliaLocationAutocomplete
                id="postcode"
                value={query}
                locationData={locationData}
                onChange={(data) => {
                  setLocationData(data);
                  setQuery(data?.displayLabel ?? "");
                }}
                placeholder="Enter postcode or suburb"
                inputClassName={LOCATION_INPUT_CLASS}
                fullWidth
                hideHelperText
              />
            )}

            {mapsError && (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                Using local suburb search{mapsError.includes("VITE_GOOGLE_MAPS") ? " — add VITE_GOOGLE_MAPS_API_KEY to .env for Google suggestions" : ""}.
              </p>
            )}
          </div>

          <div className="bg-brand-orange-light rounded-xl p-6 mb-10 flex gap-4">
            <div className="bg-brand-orange text-primary-foreground p-3 rounded-xl h-fit">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg mb-1">Local Expertise</h3>
              <p className="text-muted-foreground">
                Trusted by <span className="font-bold text-foreground">1000's of Aussie homeowners</span> looking for fast, reliable {tradeLower} quotes.
              </p>
            </div>
          </div>

          <ul className="space-y-4 mb-12">
            {["Free, no-obligation quotes", "Licensed contractors only", "100% free service"].map((text) => (
              <li key={text} className="flex items-center gap-3 text-muted-foreground font-medium">
                <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" stroke="hsl(var(--brand-orange))" strokeWidth="1.5" />
                  <path d="M6 10L9 13L14 7" stroke="hsl(var(--brand-orange))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                {text}
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button
              onClick={() => resolvedLocation && isValid && onNext(toSuburb(resolvedLocation), resolvedLocation)}
              disabled={!isValid}
              className="bg-brand-orange hover:opacity-90 disabled:opacity-50 transition-all text-primary-foreground font-bold py-4 px-10 rounded-xl text-lg flex items-center gap-3 shadow-md"
            >
              Find Local Pros
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LocationStep;
