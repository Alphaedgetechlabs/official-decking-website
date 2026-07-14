import { ArrowLeft } from 'lucide-react';

interface SubPageHeaderProps {
  title: string;
  onBack: () => void;
}

export function SubPageHeader({ title, onBack }: SubPageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-white">
      <div className="flex h-[52px] w-full items-center gap-3 px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#374151] transition-colors hover:bg-gray-100"
          aria-label={`Back from ${title}`}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <span className="text-[16px] font-bold text-[#111827]">{title}</span>
      </div>
    </header>
  );
}
