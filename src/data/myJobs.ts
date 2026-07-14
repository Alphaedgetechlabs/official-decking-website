import { HARDCODED_JOB, JOB_CONTRACTORS } from './jobContractors';

export interface MyJobItem {
  id: string;
  contractorId: string;
  businessName: string;
  jobTitle: string;
  category: string;
  createdDate: string;
  status: 'Quoted' | 'Accepted' | 'In Review';
  rating: number;
  reviews: number;
  specialty: string;
  quoteAmount: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
}

const statuses: MyJobItem['status'][] = ['Accepted', 'Quoted', 'In Review'];
const quotes = ['$4,850', '$5,200', '$4,650'];

export const MY_JOBS: MyJobItem[] = JOB_CONTRACTORS.map((contractor, index) => ({
  id: `job-${contractor.id}`,
  contractorId: contractor.id,
  businessName: contractor.name,
  jobTitle: HARDCODED_JOB.title,
  category: HARDCODED_JOB.category,
  createdDate: HARDCODED_JOB.createdDate,
  status: statuses[index],
  rating: contractor.rating,
  reviews: contractor.reviews,
  specialty: contractor.specialty,
  quoteAmount: quotes[index],
  initials: contractor.initials,
  avatarBg: contractor.avatarBg,
  avatarText: contractor.avatarText,
}));
