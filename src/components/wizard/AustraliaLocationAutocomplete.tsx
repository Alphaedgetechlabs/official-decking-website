import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import type { StoredLocation } from '../../types/location';
import { parseAustralianPlace } from '../../utils/australianPlace';

const DEFAULT_INPUT_CLASS =
  'w-full rounded-lg border px-4 py-4 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:ring-2 focus:ring-brand/30';

const PLACE_FIELDS: string[] = [
  'address_components',
  'formatted_address',
  'geometry',
  'name',
  'place_id',
  'types',
];

interface AustraliaLocationAutocompleteProps {
  id: string;
  value: string;
  locationData: StoredLocation | null;
  onChange: (locationData: StoredLocation | null) => void;
  placeholder?: string;
  inputClassName?: string;
  showIcon?: boolean;
  fullWidth?: boolean;
  hideHelperText?: boolean;
}

export function AustraliaLocationAutocomplete({
  id,
  value,
  locationData,
  onChange,
  placeholder = 'Enter postcode or suburb',
  inputClassName,
  showIcon = false,
  fullWidth = false,
  hideHelperText = false,
}: AustraliaLocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const selectedRef = useRef<StoredLocation | null>(null);
  const onChangeRef = useRef(onChange);
  const { isLoaded, error: loadError } = useGoogleMaps();
  const [inputError, setInputError] = useState<string | null>(null);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'au' },
      types: ['(regions)'],
      fields: PLACE_FIELDS,
    });

    autocompleteRef.current = autocomplete;

    const handlePlaceChanged = () => {
      const place = autocomplete.getPlace();
      const parsed = parseAustralianPlace(place);

      if (!parsed) {
        selectedRef.current = null;
        setInputError('Please select a valid Australian suburb or postcode.');
        onChangeRef.current(null);
        return;
      }

      selectedRef.current = parsed;
      setInputError(null);

      if (inputRef.current) {
        inputRef.current.value = parsed.displayLabel;
      }

      onChangeRef.current(parsed);
    };

    const handleInput = () => {
      const currentValue = inputRef.current?.value.trim() ?? '';
      const selected = selectedRef.current;

      if (selected && currentValue !== selected.displayLabel) {
        selectedRef.current = null;
        onChangeRef.current(null);
        setInputError('Please select a suburb or postcode from the suggestions.');
      } else if (!currentValue) {
        selectedRef.current = null;
        onChangeRef.current(null);
        setInputError(null);
      }
    };

    const handleBlur = () => {
      const currentValue = inputRef.current?.value.trim() ?? '';
      if (!currentValue) {
        selectedRef.current = null;
        onChangeRef.current(null);
        setInputError(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    };

    const placeListener = autocomplete.addListener(
      'place_changed',
      handlePlaceChanged,
    );
    const inputEl = inputRef.current;
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('blur', handleBlur);
    inputEl.addEventListener('keydown', handleKeyDown);

    return () => {
      google.maps.event.removeListener(placeListener);
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('blur', handleBlur);
      inputEl.removeEventListener('keydown', handleKeyDown);
      google.maps.event.clearInstanceListeners(autocomplete);
      autocompleteRef.current = null;
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!inputRef.current) return;

    if (value && locationData?.placeId) {
      inputRef.current.value = value;
      selectedRef.current = locationData;
      return;
    }

    if (!value) {
      inputRef.current.value = '';
      selectedRef.current = null;
    }
  }, [value, locationData]);

  const borderClass = inputError
    ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
    : inputClassName
      ? 'focus:ring-brand/30'
      : 'border-border focus:border-brand';

  const resolvedInputClass = inputClassName ?? DEFAULT_INPUT_CLASS;

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <div className={showIcon ? 'relative w-full' : fullWidth ? 'w-full' : undefined}>
        {showIcon && (
          <MapPin
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400"
            strokeWidth={2}
          />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          defaultValue={value}
          placeholder={placeholder}
          autoComplete="off"
          disabled={!!loadError}
          className={`${resolvedInputClass} ${fullWidth || !inputClassName ? 'w-full' : ''} ${borderClass} ${loadError ? 'cursor-not-allowed bg-gray-50' : ''}`}
        />
      </div>

      {loadError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && inputError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {inputError}
        </p>
      )}

      {!loadError && !inputError && isLoaded && !showIcon && !hideHelperText && (
        <p className="mt-2 text-xs text-body">
          Start typing and select a suburb or postcode from the list.
        </p>
      )}
    </div>
  );
}
