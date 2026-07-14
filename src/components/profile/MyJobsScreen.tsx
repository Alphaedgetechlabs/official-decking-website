import { useMemo, useState } from 'react';
import { ArrowLeft, Bell, Fence, Plus } from 'lucide-react';
import type { UserJobListItem } from '../../services/jobService';
import type { BusinessProfile } from '../../services/businessService';
import { JobDetailScreen } from './JobDetailScreen';
import { ReportIssueScreen } from './ReportIssueScreen';

type JobTab = 'all' | 'active' | 'completed';
type MyJobsView = 'list' | 'detail' | 'report';

interface MyJobsScreenProps {
  jobs: UserJobListItem[];
  loading?: boolean;
  error?: string | null;
  firstName: string;
  avatarUrl?: string;
  unreadCount?: number;
  businesses: BusinessProfile[];
  businessesLoading?: boolean;
  onBack: () => void;
  onNotificationsClick?: () => void;
  onMessage?: (businessId: string) => void;
}

const TABS: { id: JobTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
];

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-green-50 text-green-700';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-[#fff0e8] text-brand';
  }
}

function filterJobs(jobs: UserJobListItem[], tab: JobTab): UserJobListItem[] {
  switch (tab) {
    case 'active':
      return jobs.filter((job) => job.status.toLowerCase() !== 'completed');
    case 'completed':
      return jobs.filter((job) => job.status.toLowerCase() === 'completed');
    default:
      return jobs;
  }
}

function JobRow({
  job,
  onClick,
}: {
  job: UserJobListItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:border-brand/20"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe]">
        <Fence className="h-[18px] w-[18px] text-[#4a7fd4]" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-tight text-heading">
          {job.title}
        </p>
        <p className="mt-1 text-[12px] leading-none text-body">
          created {job.createdDate} • {job.category}
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${statusClass(job.status)}`}
      >
        {job.status}
      </span>
    </button>
  );
}

export function MyJobsScreen({
  jobs,
  loading,
  error,
  firstName,
  avatarUrl,
  unreadCount = 0,
  businesses,
  businessesLoading,
  onBack,
  onNotificationsClick,
  onMessage,
}: MyJobsScreenProps) {
  const [activeTab, setActiveTab] = useState<JobTab>('all');
  const [view, setView] = useState<MyJobsView>('list');
  const [selectedJob, setSelectedJob] = useState<UserJobListItem | null>(null);

  const filteredJobs = useMemo(
    () => filterJobs(jobs, activeTab),
    [jobs, activeTab],
  );

  const reportJob = selectedJob ?? filteredJobs[0] ?? jobs[0] ?? null;

  const openReport = () => {
    if (!reportJob && jobs.length === 0) return;
    setSelectedJob(reportJob);
    setView('report');
  };

  const openJobDetail = (job: UserJobListItem) => {
    setSelectedJob(job);
    setView('detail');
  };

  if (view === 'detail' && selectedJob) {
    return (
      <JobDetailScreen
        job={selectedJob}
        businesses={businesses}
        businessesLoading={businessesLoading}
        onBack={() => setView('list')}
        onMessage={onMessage}
      />
    );
  }

  if (view === 'report') {
    return (
      <ReportIssueScreen
        job={reportJob}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="min-h-svh bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-white lg:hidden">
        <div className="flex h-[52px] items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-heading"
              aria-label="Back from My Jobs"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>

            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={firstName}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-light text-[11px] font-semibold text-white">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}

            <h1 className="truncate text-[16px] font-bold text-heading">My Jobs</h1>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={openReport}
              className="flex h-9 w-9 items-center justify-center text-heading"
              aria-label="Report an issue"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={onNotificationsClick}
              className="relative flex h-9 w-9 items-center justify-center text-heading"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-10 hidden border-b border-border bg-white lg:block">
        <div className="flex h-[60px] items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-heading transition-colors hover:bg-gray-100"
              aria-label="Back from My Jobs"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-[18px] font-bold text-heading">My Jobs</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openReport}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-heading transition-colors hover:bg-surface"
              aria-label="Report an issue"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={onNotificationsClick}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-heading transition-colors hover:bg-surface"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[480px] lg:max-w-3xl">
        <div className="flex border-b border-border bg-white px-5 lg:px-8">
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex-1 py-3.5 text-center text-[14px] font-semibold transition-colors ${
                  isActive ? 'text-brand' : 'text-body'
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>

        <main className="px-5 py-5 pb-24 lg:px-8 lg:pb-10">
          {loading && (
            <div className="rounded-xl border border-border bg-white px-4 py-10 text-center text-sm text-body">
              Loading your jobs...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && filteredJobs.length === 0 && (
            <div className="rounded-xl border border-border bg-white px-4 py-10 text-center text-sm text-body">
              {activeTab === 'completed'
                ? 'No completed jobs yet.'
                : 'No jobs posted yet. Tap + on home to post a job.'}
            </div>
          )}

          {!loading && !error && filteredJobs.length > 0 && (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onClick={() => openJobDetail(job)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
