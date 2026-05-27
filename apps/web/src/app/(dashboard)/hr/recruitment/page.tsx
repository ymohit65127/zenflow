'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Briefcase, Plus, Users, MapPin, ChevronRight, X, Check } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-red-100 text-red-600',
};

type Job = {
  id: string;
  title: string;
  location: string | null;
  job_type: string;
  experience_min: number;
  experience_max: number | null;
  status: string;
  openings: number;
  applications_count: number;
  posted_at: Date | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  _count: { applications: number };
};

function NewJobDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { data: depts = [] } = api.hr.hr_departments.list.useQuery();
  const [form, setForm] = useState({
    title: '',
    department_id: '',
    location: '',
    job_type: 'full_time' as const,
    experience_min: 0,
    openings: 1,
    description: '',
    requirements: '',
  });

  const create = api.hr.hr_recruitment.createJob.useMutation({
    onSuccess: () => { void utils.hr.hr_recruitment.listJobs.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">New Job Posting</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Job Title *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="e.g. Senior Software Engineer" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
                <option value="">Any</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Job Type</label>
              <select value={form.job_type} onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value as typeof f.job_type }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
                {['full_time', 'part_time', 'contract', 'internship'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Mumbai" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Openings</label>
              <input type="number" min={1} value={form.openings} onChange={(e) => setForm((f) => ({ ...f, openings: Number(e.target.value) }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {create.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Create Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RecruitmentPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const utils = api.useUtils();

  const { data: jobs = [], isLoading } = api.hr.hr_recruitment.listJobs.useQuery(
    statusFilter ? { status: statusFilter as 'draft' | 'active' | 'paused' | 'closed' } : {},
  );

  const publish = api.hr.hr_recruitment.publishJob.useMutation({
    onSuccess: () => void utils.hr.hr_recruitment.listJobs.invalidate(),
  });
  const close = api.hr.hr_recruitment.closeJob.useMutation({
    onSuccess: () => void utils.hr.hr_recruitment.listJobs.invalidate(),
  });

  const activeJobs = (jobs as Job[]).filter((j) => j.status === 'active');
  const totalApplications = (jobs as Job[]).reduce((s, j) => s + j._count.applications, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recruitment</h1>
          <p className="text-muted-foreground mt-1">
            {activeJobs.length} active openings · {totalApplications} total applications
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Post Job
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'active', 'draft', 'paused', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors border',
              statusFilter === s
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-background border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (jobs as Job[]).length === 0 ? (
        <div className="text-center py-20">
          <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No job postings</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(jobs as Job[]).map((job) => (
            <div key={job.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{job.title}</h3>
                  {job.department && <p className="text-xs text-muted-foreground mt-0.5">{job.department.name}</p>}
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize ml-2 flex-shrink-0', STATUS_COLORS[job.status] ?? '')}>
                  {job.status}
                </span>
              </div>

              <div className="space-y-1.5 mb-4">
                {job.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                  <Briefcase className="w-3 h-3" />
                  {job.job_type.replace('_', ' ')} · {job.openings} opening{job.openings !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {job._count.applications} applicants
                </div>
              </div>

              <div className="flex gap-2">
                {job.status === 'draft' && (
                  <button
                    onClick={() => publish.mutate({ id: job.id })}
                    disabled={publish.isPending}
                    className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {job.status === 'active' && (
                  <button
                    onClick={() => { if (confirm('Close this job posting?')) close.mutate({ id: job.id }); }}
                    className="flex-1 px-3 py-1.5 border border-border hover:bg-muted rounded-lg text-xs font-medium"
                  >
                    Close
                  </button>
                )}
                <Link
                  href={`/hr/recruitment/${job.id}`}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 border border-border hover:bg-muted rounded-lg text-xs font-medium"
                >
                  View <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDialog && <NewJobDialog onClose={() => setShowDialog(false)} />}
    </div>
  );
}
