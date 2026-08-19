import { ChevronRight } from 'lucide-react';
import {
  brandLogoAlt,
  brandNamePrefix,
  brandNameSuffix,
} from '@/config/brandDomain';
const QUOTE_COLOR = '#FF6A1C';
const MY_COLOR = '#666666';
const REST_COLOR = '#333333';
const REST_COLOR_ON_DARK = '#ffffff';

interface AppLogoProps {
  variant?: 'light' | 'dark';
  /** Show orange › chevron (marketing header style). */
  showChevron?: boolean;
  showSubtitle?: boolean;
}

export function AppLogo({
  variant = 'dark',
  showChevron = false,
}: AppLogoProps) {
  const isLight = variant === 'light';
  const hasMyPrefix = brandNameSuffix.startsWith('My');
  const restLabel = hasMyPrefix ? brandNameSuffix.slice(2) : brandNameSuffix;
  const restColor = isLight ? REST_COLOR_ON_DARK : REST_COLOR;

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`truncate font-bold tracking-tight leading-none ${
          isLight ? 'text-[24px]' : 'text-[30px] sm:text-[34px]'
        }`}
        aria-label={brandLogoAlt}
      >
        <span style={{ color: QUOTE_COLOR }}>{brandNamePrefix}</span>
        {hasMyPrefix && <span style={{ color: MY_COLOR }}>My</span>}
        <span style={{ color: restColor }}>{restLabel}</span>
      </span>
      {showChevron && (
        <ChevronRight
          className="hidden h-4 w-4 shrink-0 sm:block"
          style={{ color: QUOTE_COLOR }}
          strokeWidth={2.5}
          aria-hidden
        />
      )}
    </div>
  );
}
