'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Users, Mail, Phone, X, Check, ChevronDown } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';

const STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-gray-100' },
  { key: 'screening', label: 'Screening', color: 'bg-blue-50' },
  { key: 'phone_screen', label: 'Phone Screen', color: 'bg-indigo-50' },
  { key: 'interview_1', label: 'Interview 1', color: 'bg-yellow-50' },
  { key: 'interview_2', label: 'Interview 2', color: 'bg-orange-50' },
  { key: 'technical', label: 'Technical', color: 'bg-purple-50' },
  { key: 'hr', label: 'HR Round', color: 'bg-pink-50' },
  { key: 'offer', label: 'Offer', color: 'bg-teal-50' },
  { key: 'hired', label: 'Hired', color: 'bg-green-50' },
] as const;

type Application = {
  id: string;
  candidate_name: string;
  email: string;
  phone: string | null;
  stage: string;
  score: number;
  source: string | null;
  expected_ctc: unknown;
  created_at: Date;
};

function AddApplicationDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    candidate_name: '',
    email: '',
    phone: '',
    source: '' as '' | 'linkedin' | 'naukri' | 'indeed' | 'referral' | 'direct' | 'other',
    expected_ctc: '',
    notice_period_days: '',
  });

  const create = api.hr.hr_recruitment.createApplication.useMutation({
    onSuccess: () => { void utils.hr.hr_recruitment.listApplications.invalidate({ job_id: jobId }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Add Candidate</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            job_id: jobId,
            candidate_name: form.candidate_name,
            email: form.email,
            phone: form.phone || undefined,
            source: form.source || undefined,
            expected_ctc: form.expected_ctc ? Number(form.expected_ctc) : undefined,
            notice_period_days: form.notice_period_days ? Number(form.notice_period_days) : undefined,
          });
        }} className="p-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={form.candidate_name} onChange={(e) => setForm((f) => ({ ...f, candidate_name: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as typeof f.source }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
                <option value="">—</option>
                {['linkedin', 'naukri', 'indeed', 'referral', 'direct', 'other'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
              {create.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppCard({ app, jobId }: { app: Application; jobId: string }) {
  const utils = api.useUtils();
  const [showMove, setShowMove] = useState(false);

  const moveStage = api.hr.hr_recruitment.moveStage.useMutation({
    onSuccess: () => { void utils.hr.hr_recruitment.listApplications.invalidate({ job_id: jobId }); setShowMove(false); },
  });
  const reject = api.hr.hr_recruitment.rejectApplication.useMutation({
    onSuccess: () => void utils.hr.hr_recruitment.listApplications.invalidate({ job_id: jobId }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-3 text-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold truncate">{app.candidate_name}</p>
          {app.score > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-mono">{app.score}/100</span>
          )}
        </div>
        <button onClick={() => setShowMove((p) => !p)} className="p-1 rounded hover:bg-muted flex-shrink-0">
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> <span className="truncate">{app.email}</span></div>
        {app.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone}</div>}
        {app.source && <span className="capitalize bg-muted px-1.5 py-0.5 rounded">{app.source}</span>}
      </div>

      <p className="text-xs text-muted-foreground mt-2">{formatDate(app.created_at)}</p>

      {showMove && (
        <div className="mt-2 border-t border-border pt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">Move to stage:</p>
          {STAGES.filter((s) => s.key !== app.stage).slice(0, 4).map((s) => (
            <button
              key={s.key}
              onClick={() => moveStage.mutate({ id: app.id, stage: s.key })}
              disabled={moveStage.isPending}
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted"
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => { if (confirm('Reject this application?')) reject.mutate({ id: app.id, reason: 'Does not meet requirements' }); }}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: job, isLoading } = api.hr.hr_recruitment.getJob.useQuery({ id });
  const { data: applications = [] } = api.hr.hr_recruitment.listApplications.useQuery({ job_id: id });

  const apps = applications as Application[];

  if (isLoading) return <div className="h-96 bg-muted animate-pulse rounded-xl" />;
  if (!job) return <p className="text-muted-foreground">Job not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/hr/recruitment" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{job.title}</h1>
          <p className="text-muted-foreground mt-0.5 capitalize">{job.status} · {apps.length} applicants</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Candidate
        </button>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const stageApps = apps.filter((a) => a.stage === stage.key);
            return (
              <div key={stage.key} className={cn('w-56 rounded-xl p-3 flex-shrink-0', stage.color, 'border border-border/50')}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold">{stage.label}</p>
                  <span className="text-xs bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded-full font-medium">
                    {stageApps.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageApps.length === 0 ? (
                    <div className="py-6 text-center">
                      <Users className="w-6 h-6 mx-auto text-muted-foreground/40" />
                    </div>
                  ) : (
                    stageApps.map((app) => <AppCard key={app.id} app={app} jobId={id} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAddDialog && <AddApplicationDialog jobId={id} onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}
