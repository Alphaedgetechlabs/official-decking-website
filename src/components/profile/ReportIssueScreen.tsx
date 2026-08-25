import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Fence,
  MessageCircle,
} from 'lucide-react';
import type { UserJobListItem } from '../../services/jobService';

type UrgencyLevel = 'normal' | 'high' | 'urgent';

const CATEGORIES = [
  'Quality Issue',
  'Delayed Work',
  'Payment Issue',
  'Communication Issue',
  'Other',
];

interface ReportIssueScreenProps {
  job: UserJobListItem | null;
  onBack: () => void;
}

export function ReportIssueScreen({ job, onBack }: ReportIssueScreenProps) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!description.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-svh bg-surface">
        <header className="sticky top-0 z-10 border-b border-border bg-white">
          <div className="mx-auto flex h-[52px] max-w-[480px] items-center gap-3 px-4 lg:max-w-3xl lg:px-8">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-heading"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-[16px] font-bold text-heading">Report an Issue</h1>
          </div>
        </header>
        <div className="mx-auto max-w-[480px] px-5 py-10 text-center lg:max-w-3xl lg:px-8">
          <p className="text-[16px] font-bold text-heading">Report submitted</p>
          <p className="mt-2 text-sm text-body">
            Our team will review your issue and get back to you shortly.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white"
          >
            Back to My Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-[52px] max-w-[480px] items-center gap-3 px-4 lg:max-w-3xl lg:px-8 lg:h-[60px]">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-heading"
            aria-label="Back to My Jobs"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-[16px] font-bold text-heading lg:text-[18px]">
            Report an Issue
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[480px] space-y-4 px-5 py-5 pb-24 lg:max-w-3xl lg:px-8 lg:pb-10">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
            Job Reference
          </p>
          {job ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light">
                <Fence className="h-[18px] w-[18px] text-brand" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-heading">
                  {job.title}
                </p>
                <p className="mt-0.5 text-[12px] text-body">
                  {job.location || 'Location pending'} • {job.createdDate}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-body">No job selected. Post a job first.</p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
              Category
            </p>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-surface px-3 pr-9 text-[13px] font-medium text-heading outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-body" />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
              Urgency Level
            </p>
            <div className="flex gap-2">
              {(
                [
                  { id: 'normal', label: 'Normal' },
                  { id: 'high', label: 'High' },
                  { id: 'urgent', label: 'Urgent' },
                ] as const
              ).map(({ id, label }) => {
                const selected = urgency === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUrgency(id)}
                    className={`flex-1 rounded-lg border py-2 text-[11px] font-semibold transition-colors sm:text-[12px] ${
                      selected
                        ? 'border-brand bg-brand-light text-brand'
                        : 'border-border bg-white text-body'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.12em] text-body uppercase">
            Describe the Issue
          </p>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please provide as much detail as possible..."
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3.5 text-[13px] text-heading placeholder:text-body outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </section>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white py-3.5 text-[14px] font-semibold text-heading shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors hover:bg-surface"
        >
          <MessageCircle className="h-4 w-4 text-brand" strokeWidth={1.75} />
          Live Chat
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!description.trim() || !job}
          className="w-full rounded-2xl bg-brand py-3.5 text-[15px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-brand-muted"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
