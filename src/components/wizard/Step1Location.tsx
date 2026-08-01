import { useCallback } from 'react';
import { CheckCircle2, Info, MapPin, Zap } from 'lucide-react';
import { tradeLabel } from '../../config/brandDomain';
import { useWizard } from '../../context/WizardContext';
import type { StoredLocation } from '../../types/location';
import {
  isLocationValidated,
  toLocationFormUpdate,
} from '../../utils/australianPlace';
import { AustraliaLocationAutocomplete } from './AustraliaLocationAutocomplete';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';
import { WizardPrimaryButton } from './WizardPrimaryButton';

const BENEFITS = [
  { id: 'quotes', label: 'Free, no-obligation quotes' },
  { id: 'licensed', label: 'Licensed contractors only' },
  { id: 'free', label: '100% free service' },
];

export function Step1Location() {
  const { formData, updateFormData, nextStep, variant } = useWizard();
  const isValid = isLocationValidated(formData.locationData);

  const handleLocationChange = useCallback(
    (locationData: StoredLocation | null) => {
      updateFormData(toLocationFormUpdate(locationData));
    },
    [updateFormData],
  );

  if (variant === 'addJob') {
    return (
      <StepShell>
        <ProgressHeader step={1} />

        <h2 className="text-center text-lg font-bold text-heading">
          New Project Details
        </h2>

        <p className="mt-5 text-sm font-bold text-heading">
          What is the job location?
        </p>

        <div className="mt-3 w-full">
          <AustraliaLocationAutocomplete
            id="add-job-location"
            value={formData.location}
            locationData={formData.locationData}
            onChange={handleLocationChange}
            placeholder="Postcode or Suburb"
            inputClassName="w-full rounded-xl border-0 bg-gray-100 px-4 py-3.5 pl-10 text-sm text-heading placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand/30"
            showIcon
            fullWidth
          />
          <p className="mt-2 text-xs text-body">
            This helps us find the best local tradies for you.
          </p>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
          <p className="text-xs leading-relaxed text-body">
            Next, we&apos;ll ask about your {tradeLabel} type and dimensions.
          </p>
        </div>

        <div className="mt-auto pt-6">
          <WizardPrimaryButton
            onClick={nextStep}
            disabled={!isValid}
            fullWidth
          >
            Next
          </WizardPrimaryButton>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell>
      <ProgressHeader step={1} />

      <h1 className="text-2xl font-bold leading-tight text-heading sm:text-[1.65rem]">
        Where&apos;s the job located?
      </h1>

      <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-body">
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-brand"
          strokeWidth={2}
        />
        <span>
          We&apos;ll instantly match you with{' '}
          <strong className="font-semibold text-brand">
            verified local {tradeLabel} pros
          </strong>{' '}
          who are available right now.
        </span>
      </p>

      <div className="mt-6">
        <label
          htmlFor="location"
          className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
        >
          <MapPin className="h-4 w-4" strokeWidth={2} />
          Postcode or Suburb
        </label>
        <AustraliaLocationAutocomplete
          id="location"
          value={formData.location}
          locationData={formData.locationData}
          onChange={handleLocationChange}
        />
      </div>

      <div className="mt-6 flex gap-4 rounded-xl bg-brand-light p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand">
          <Zap className="h-5 w-5 text-white" fill="white" strokeWidth={0} />
        </div>
        <div>
          <p className="text-sm font-bold text-heading">Local Expertise</p>
          <p className="mt-0.5 text-sm leading-relaxed text-body">
            Trusted by{' '}
            <strong className="font-semibold text-heading">
              1000&apos;s of Aussie homeowners
            </strong>{' '}
            looking for fast, reliable {tradeLabel} quotes.
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3.5">
        {BENEFITS.map(({ id, label }) => (
          <li key={id} className="flex items-center gap-2.5 text-sm text-body">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-brand"
              strokeWidth={2}
            />
            <span className="font-semibold text-heading">{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <WizardPrimaryButton
          onClick={nextStep}
          disabled={!isValid}
          fullWidth
        >
          Find Local Pros
        </WizardPrimaryButton>
      </div>
    </StepShell>
  );
}
