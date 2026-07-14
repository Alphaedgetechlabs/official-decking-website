import { Calendar, Megaphone, MessageCircle } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';
import type { TimelineOption } from '../../types/wizard';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';

const TIMELINE_OPTIONS: {
  value: TimelineOption;
  label: string;
  sublabel: string;
  icon: typeof Megaphone;
}[] = [
  {
    value: 'asap',
    label: 'ASAP',
    sublabel: 'Urgent job',
    icon: Megaphone,
  },
  {
    value: 'within-2-weeks',
    label: 'Within 2 weeks',
    sublabel: 'Ready to book soon',
    icon: Calendar,
  },
  {
    value: 'in-a-month',
    label: 'In a month',
    sublabel: 'Planning ahead',
    icon: Calendar,
  },
  {
    value: 'comparing',
    label: 'Just comparing quotes',
    sublabel: 'No pressure',
    icon: MessageCircle,
  },
];

export function Step2Timeline() {
  const { formData, updateFormData, nextStep, prevStep, variant } = useWizard();
  const isValid = formData.timeline !== '';

  return (
    <StepShell>
      <ProgressHeader step={2} />

      <h1
        className={`font-bold leading-tight text-heading ${
          variant === 'addJob'
            ? 'text-center text-lg'
            : 'text-2xl sm:text-[1.65rem]'
        }`}
      >
        When do you want the job done?
      </h1>
      <p className={`mt-2 text-sm text-body ${variant === 'addJob' ? 'text-center' : ''}`}>
        We&apos;ll prioritise contractors who can meet your timeline.
      </p>

      <div className="mt-8 space-y-4">
        {TIMELINE_OPTIONS.map(({ value, label, sublabel, icon: Icon }) => {
          const selected = formData.timeline === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => updateFormData({ timeline: value })}
              className={`flex w-full min-h-[64px] items-center gap-4 rounded-xl border px-5 py-5 text-left transition-colors ${
                selected
                  ? 'border-brand bg-brand-light'
                  : 'border-border bg-white hover:border-gray-300'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${selected ? 'text-brand' : 'text-gray-500'}`}
                strokeWidth={1.75}
              />
              <span className="text-sm text-heading">
                <span className="font-medium">{label}</span>
                <span className="text-body"> — {sublabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <NavButtons
        onBack={prevStep}
        continueDisabled={!isValid}
        onContinue={nextStep}
        continueLabel={variant === 'addJob' ? 'Next' : 'Continue'}
      />
    </StepShell>
  );
}
