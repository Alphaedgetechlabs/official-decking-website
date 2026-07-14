export interface JobContractor {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  specialty: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
}

export const JOB_CONTRACTORS: JobContractor[] = [
  {
    id: 'sa-local-deck',
    name: 'SA Local Deck Co.',
    rating: 4.8,
    reviews: 110,
    specialty: 'Top Rated',
    initials: 'SL',
    avatarBg: 'bg-orange-100',
    avatarText: 'text-brand',
  },
  {
    id: 'sa-timberline',
    name: 'SA TimberLine Decking',
    rating: 4.7,
    reviews: 87,
    specialty: 'Decking Expert',
    initials: 'ST',
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-600',
  },
  {
    id: 'sa-securebound',
    name: 'SA SecureBound Decking',
    rating: 4.9,
    reviews: 142,
    specialty: 'Decking Specialist',
    initials: 'SS',
    avatarBg: 'bg-gray-200',
    avatarText: 'text-gray-600',
  },
];

export const HARDCODED_JOB = {
  title: 'Fence Installation',
  category: 'Fence',
  createdDate: 'Oct 12',
  status: 'Accepted' as const,
};
