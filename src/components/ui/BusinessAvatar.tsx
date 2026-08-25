import { useEffect, useMemo, useState } from 'react';
import {
  getBusinessAvatarStyle,
  getBusinessInitials,
} from '../../utils/businessDisplay';

interface BusinessAvatarProps {
  businessName: string;
  logoUrl?: string | null;
  className?: string;
  initialsOverride?: string;
  avatarBgOverride?: string;
  avatarTextOverride?: string;
}

export function BusinessAvatar({
  businessName,
  logoUrl,
  className = '',
  initialsOverride,
  avatarBgOverride,
  avatarTextOverride,
}: BusinessAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedLogoUrl = useMemo(
    () => (typeof logoUrl === 'string' ? logoUrl.trim() : ''),
    [logoUrl],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedLogoUrl]);

  const initials = initialsOverride ?? getBusinessInitials(businessName);
  const { avatarBg, avatarText } = getBusinessAvatarStyle(businessName);
  const fallbackBg = avatarBgOverride ?? avatarBg;
  const fallbackText = avatarTextOverride ?? avatarText;
  const showLogo = normalizedLogoUrl.length > 0 && !imageFailed;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full ${fallbackBg} ${fallbackText} ${className}`}
    >
      {showLogo ? (
        <img
          src={normalizedLogoUrl}
          alt={businessName}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
