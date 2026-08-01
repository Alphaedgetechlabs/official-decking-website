import { ChevronRight } from 'lucide-react';
import {
  brandLogoAlt,
  brandNamePrefix,
  brandNameSuffix,
} from '@/config/brandDomain';
import fenceLogoMark from '@/assets/qm-fence-logo.png';

/** Exact colors from qm-fence-logo.png (orange picket / dark pickets). */
const LOGO_ORANGE = '#e06c36';
const LOGO_DARK = '#29272c';

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

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img
        src={fenceLogoMark}
        alt={brandLogoAlt}
        className={
          isLight
            ? 'h-7 w-auto shrink-0 object-contain rounded-md bg-white p-0.5'
            : 'h-[42px] w-auto shrink-0 object-contain sm:h-[48px]'
        }
      />
      <span
        className={`truncate font-bold tracking-tight leading-none ${
          isLight ? 'text-[15px]' : 'text-[26px] sm:text-[28px]'
        }`}
      >
        <span style={{ color: LOGO_ORANGE }}>{brandNamePrefix}</span>
        <span style={{ color: isLight ? '#ffffff' : LOGO_DARK }}>
          {brandNameSuffix}
        </span>
      </span>
      {showChevron && (
        <ChevronRight
          className="hidden h-4 w-4 shrink-0 sm:block"
          style={{ color: LOGO_ORANGE }}
          strokeWidth={2.5}
          aria-hidden
        />
      )}
    </div>
  );
}
