import { useRef } from 'react';
import { FileText, ImageIcon, Upload, X } from 'lucide-react';
import { tradeLabel } from '../../config/brandDomain';
import { useWizard } from '../../context/WizardContext';
import { MAX_PHOTOS, type UploadedFile } from '../../types/wizard';
import { NavButtons } from './NavButtons';
import { ProgressHeader } from './ProgressHeader';
import { StepShell } from './StepShell';

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

export function Step3JobDescription() {
  const { formData, updateFormData, nextStep, prevStep, variant } = useWizard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isValid = formData.jobDescription.trim().length > 0;
  const canAddMore = formData.photos.length < MAX_PHOTOS;

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = MAX_PHOTOS - formData.photos.length;
    const incoming = Array.from(files).slice(0, remaining);

    const newPhotos: UploadedFile[] = incoming.map((file) => ({
      file,
      preview: isImageFile(file) ? URL.createObjectURL(file) : '',
    }));

    updateFormData({ photos: [...formData.photos, ...newPhotos] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const photo = formData.photos[index];
    if (photo?.preview) URL.revokeObjectURL(photo.preview);
    updateFormData({
      photos: formData.photos.filter((_, i) => i !== index),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <StepShell>
      <ProgressHeader step={3} />

      <h1
        className={`font-bold leading-tight text-heading ${
          variant === 'addJob'
            ? 'text-center text-lg'
            : 'text-2xl sm:text-[1.65rem]'
        }`}
      >
        Describe your {tradeLabel} job
      </h1>
      <p className={`mt-2 text-sm text-body ${variant === 'addJob' ? 'text-center' : ''}`}>
        The more detail you add, the more accurate your quotes will be.
      </p>

      <div className="mt-6">
        <label
          htmlFor="jobDescription"
          className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-heading"
        >
          <FileText className="h-4 w-4" strokeWidth={2} />
          Job Description
        </label>
        <textarea
          id="jobDescription"
          rows={5}
          value={formData.jobDescription}
          onChange={(e) => updateFormData({ jobDescription: e.target.value })}
          placeholder={`Describe your ${tradeLabel} project...`}
          className="w-full resize-none rounded-lg border border-border px-4 py-4 text-sm text-heading placeholder:text-gray-400 outline-none transition-shadow focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <p className="mt-2 text-xs text-gray-400">
          Example: &apos;Need a new {tradeLabel} installed along the side boundary.
          Approx 12m. Include gate.&apos;
        </p>
      </div>

      <div className="mt-6">
        <label className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-heading">
          <Upload className="h-4 w-4" strokeWidth={2} />
          Add photos
        </label>
        <p className="mb-3 text-xs text-body">
          Optional — add up to {MAX_PHOTOS} photos. Adding photos increases
          quote accuracy by up to 32%.
        </p>

        {canAddMore && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                fileInputRef.current?.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-12 transition-colors hover:border-gray-300 hover:bg-gray-100/80"
          >
            <Upload className="mb-2 h-8 w-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm font-medium text-heading">
              Click to upload or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Images, PDF, DOC — {formData.photos.length}/{MAX_PHOTOS} added
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {formData.photos.length > 0 && (
          <div className="mt-3 space-y-2">
            {formData.photos.map((photo, index) => (
              <div
                key={`${photo.file.name}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-gray-50 px-3 py-2"
              >
                {photo.preview ? (
                  <img
                    src={photo.preview}
                    alt={photo.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200">
                    <ImageIcon className="h-5 w-5 text-gray-500" />
                  </div>
                )}
                <span className="flex-1 truncate text-sm text-body">
                  {photo.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                  aria-label={`Remove ${photo.file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <NavButtons
        onBack={prevStep}
        continueDisabled={!isValid}
        onContinue={nextStep}
        continueLabel={variant === 'addJob' ? 'Next' : 'Continue'}
      />
    </StepShell>
  );
}
