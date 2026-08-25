import * as React from 'react';
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { cn } from '@/lib/utils';

function OtpBox({ index }: { index: number }) {
  const { slots } = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = slots[index];

  return (
    <div
      className={cn(
        'relative flex h-12 w-12 items-center justify-center rounded-lg border border-border text-lg font-semibold text-heading transition-shadow sm:h-14 sm:w-14',
        isActive && 'border-brand ring-2 ring-brand/30',
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-pulse bg-brand" />
        </div>
      )}
    </div>
  );
}

interface OtpBoxesInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function OtpBoxesInput({
  id,
  value,
  onChange,
  autoFocus,
  disabled,
}: OtpBoxesInputProps) {
  return (
    <OTPInput
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern={REGEXP_ONLY_DIGITS}
      containerClassName="flex justify-center"
    >
      <div className="flex gap-2 sm:gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <OtpBox key={index} index={index} />
        ))}
      </div>
    </OTPInput>
  );
}
