import { Plus } from 'lucide-react';

interface AddJobFabProps {
  onClick: () => void;
}

export function AddJobFab({ onClick }: AddJobFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[calc(74px+env(safe-area-inset-bottom))] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_4px_16px_rgba(232,122,77,0.45)] transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8"
      aria-label="Add new job"
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
