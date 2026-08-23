import BrandLogo from '@/components/BrandLogo';

interface AppLogoProps {
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export function AppLogo({ variant = 'dark' }: AppLogoProps) {
  return <BrandLogo variant={variant} className="text-[26px]" />;
}
