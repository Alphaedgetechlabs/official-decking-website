import { useEffect } from 'react';
import { X } from 'lucide-react';
import { WizardProvider } from '../../context/WizardContext';
import type { BusinessProfile } from '../../services/businessService';
import type { UserDocument } from '../../types/user';
import { INITIAL_FORM_DATA } from '../../types/wizard';
import { AddJobWizard } from './AddJobWizard';

interface AddJobSheetProps {
  open: boolean;
  user: UserDocument;
  uid: string;
  userId: string;
  matchedBusinesses: BusinessProfile[];
  onClose: () => void;
  onJobPosted: () => void;
}

export function AddJobSheet({
  open,
  user,
  uid,
  userId,
  matchedBusinesses,
  onClose,
  onJobPosted,
}: AddJobSheetProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const initialFormData = {
    ...INITIAL_FORM_DATA,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
  };

  return (
    <div className="fixed inset-0 z-50 lg:pl-[240px] xl:pl-[260px]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close add job sheet"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add new job"
        className="absolute inset-x-0 bottom-0 flex min-h-[78svh] max-h-[94svh] w-full animate-[slideUp_0.3s_ease-out] flex-col rounded-t-[20px] bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] lg:min-h-[82svh] lg:max-h-[92svh]"
      >
        <div className="flex shrink-0 flex-col items-center px-5 pt-3 pb-2">
          <div className="mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full text-heading transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:px-8">
          <WizardProvider
            variant="addJob"
            initialFormData={initialFormData}
            initialMatchedBusinesses={matchedBusinesses}
          >
            <AddJobWizard
              uid={uid}
              userId={userId}
              onComplete={() => {
                onJobPosted();
                onClose();
              }}
            />
          </WizardProvider>
        </div>
      </div>
    </div>
  );
}
