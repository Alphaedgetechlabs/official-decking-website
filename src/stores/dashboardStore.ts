import { create } from 'zustand';
import type { BusinessProfile } from '../services/businessService';
import type { UserJobListItem } from '../services/jobService';
import type { UserDocument } from '../types/user';

interface DashboardState {
  user: UserDocument | null;
  businesses: BusinessProfile[];
  businessesIdsKey: string;
  jobs: UserJobListItem[];

  setUser: (user: UserDocument | null) => void;
  patchUser: (patch: Partial<UserDocument>) => void;
  setBusinesses: (businesses: BusinessProfile[], idsKey: string) => void;
  setJobs: (jobs: UserJobListItem[]) => void;
  clear: () => void;
}

const initialState = {
  user: null,
  businesses: [] as BusinessProfile[],
  businessesIdsKey: '',
  jobs: [] as UserJobListItem[],
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  ...initialState,

  setUser: (user) => set({ user }),

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  setBusinesses: (businesses, idsKey) => set({ businesses, businessesIdsKey: idsKey }),

  setJobs: (jobs) => set({ jobs }),

  clear: () => set(initialState),
}));
