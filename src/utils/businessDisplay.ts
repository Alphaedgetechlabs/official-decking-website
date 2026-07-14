const AVATAR_STYLES = [
  { avatarBg: 'bg-orange-100', avatarText: 'text-brand' },
  { avatarBg: 'bg-blue-100', avatarText: 'text-blue-600' },
  { avatarBg: 'bg-gray-200', avatarText: 'text-gray-600' },
  { avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-600' },
  { avatarBg: 'bg-violet-100', avatarText: 'text-violet-600' },
] as const;

export function getBusinessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function getBusinessAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_STYLES.length;
  }
  return AVATAR_STYLES[hash];
}

/** Placeholder display values until ratings are stored in Firestore. */
export function getBusinessDisplayMeta(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const rating = (4.5 + (Math.abs(hash) % 5) / 10).toFixed(1);
  const reviews = 60 + (Math.abs(hash) % 120);
  const specialties = ['Top Rated', 'Fencing Expert', 'Decking Specialist'];
  const specialty = specialties[Math.abs(hash) % specialties.length];

  return {
    rating: Number(rating),
    reviews,
    specialty,
  };
}
