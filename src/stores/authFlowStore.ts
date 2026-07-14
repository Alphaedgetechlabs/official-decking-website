import { create } from 'zustand';
import { hasActiveSession } from '@/utils/session';

interface AuthFlowState {
  optimisticAuth: boolean;
  setOptimisticAuth: (active: boolean) => void;
  clear: () => void;
}

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  optimisticAuth: false,
  setOptimisticAuth: (active) => set({ optimisticAuth: active }),
  clear: () => set({ optimisticAuth: false }),
}));

export function canAccessApp(isAuthenticated: boolean): boolean {
  const { optimisticAuth } = useAuthFlowStore.getState();
  return hasActiveSession() && (isAuthenticated || optimisticAuth);
}
