import { Plus } from 'lucide-react';

interface AddJobFabProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AddJobFab({ onClick, disabled = false }: AddJobFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`fixed bottom-[calc(74px+env(safe-area-inset-bottom))] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white lg:bottom-8 lg:right-8 ${
        disabled
          ? 'cursor-not-allowed bg-gray-300 shadow-none'
          : 'bg-brand shadow-[0_4px_16px_rgba(232,122,77,0.45)] transition-transform hover:scale-105 active:scale-95'
      }`}
      aria-label="Add new job"
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
