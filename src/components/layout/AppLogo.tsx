import { Fence } from 'lucide-react';

interface AppLogoProps {
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export function AppLogo({ variant = 'dark', showSubtitle = true }: AppLogoProps) {
  const isLight = variant === 'light';

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
        <Fence className="h-[18px] w-[18px] text-white" strokeWidth={2} />
      </div>
      <div className="leading-tight">
        <span
          className={`block text-[15px] font-bold tracking-tight ${
            isLight ? 'text-white' : 'text-heading'
          }`}
        >
          QM Fencing
        </span>
        {showSubtitle && (
          <span
            className={`block text-[10px] font-medium ${
              isLight ? 'text-white/55' : 'text-body'
            }`}
          >
            QuoteMyFence
          </span>
        )}
      </div>
    </div>
  );
}
