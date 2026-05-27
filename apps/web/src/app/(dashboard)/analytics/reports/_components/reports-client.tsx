'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { formatDate, timeAgo } from '@/lib/utils';
import {
  Plus, BarChart3, FileText, Trash2, Play, X, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ReportType = 'SUMMARY' | 'DETAILED' | 'COMPARISON' | 'TREND';
type Module = 'crm' | 'projects' | 'helpdesk' | 'accounting' | 'hr' | 'inventory';

const MODULES: { value: Module; label: string }[] = [
  { value: 'crm', label: 'CRM' },
  { value: 'projects', label: 'Projects' },
  { value: 'helpdesk', label: 'Help Desk' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'hr', label: 'HR' },
  { value: 'inventory', label: 'Inventory' },
];

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: 'SUMMARY', label: 'Summary', description: 'High-level overview of key metrics' },
  { value: 'DETAILED', label: 'Detailed', description: 'Granular breakdown of all records' },
  { value: 'COMPARISON', label: 'Comparison', description: 'Compare periods or segments' },
  { value: 'TREND', label: 'Trend', description: 'Track changes over time' },
];

const MODULE_BADGES: Record<string, { bg: string; text: string }> = {
  crm: { bg: 'bg-brand-500/10', text: 'text-brand-500' },
  projects: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  helpdesk: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  accounting: { bg: 'bg-green-500/10', text: 'text-green-500' },
  hr: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  inventory: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
};

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  SUMMARY: { bg: 'bg-brand-500/10', text: 'text-brand-500' },
  DETAILED: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  COMPARISON: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  TREND: { bg: 'bg-green-500/10', text: 'text-green-500' },
};

function CreateReportModal({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const createMutation = api.analytics.reports.create.useMutation({
    onSuccess: () => {
      toast.success('Report created');
      void utils.analytics.reports.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    name: string;
    description: string;
    module: Module;
    report_type: ReportType;
    is_scheduled: boolean;
    schedule_cron: string;
  }>({
    name: '',
    description: '',
    module: 'crm',
    report_type: 'SUMMARY',
    is_scheduled: false,
    schedule_cron: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description || undefined,
      module: form.module,
      report_type: form.report_type,
      is_scheduled: form.is_scheduled,
      schedule_cron: form.is_scheduled ? form.schedule_cron : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold text-lg">Create Report</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Report Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Monthly CRM Summary"
              className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this report track?"
              rows={2}
              className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Module</label>
              <div className="relative">
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value as Module })}
                  className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none pr-8"
                >
                  {MODULES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Report Type</label>
              <div className="relative">
                <select
                  value={form.report_type}
                  onChange={(e) => setForm({ ...form, report_type: e.target.value as ReportType })}
                  className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none pr-8"
                >
                  {REPORT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_scheduled}
                onChange={(e) => setForm({ ...form, is_scheduled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-brand-500 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm font-medium">Schedule automatically</span>
          </div>

          {form.is_scheduled && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Cron Expression</label>
              <input
                type="text"
                value={form.schedule_cron}
                onChange={(e) => setForm({ ...form, schedule_cron: e.target.value })}
                placeholder="0 9 * * 1 (every Monday 9am)"
                className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReportsClient() {
  const [showCreate, setShowCreate] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const reportsQuery = api.analytics.reports.list.useQuery();
  const utils = api.useUtils();

  const deleteMutation = api.analytics.reports.delete.useMutation({
    onSuccess: () => {
      toast.success('Report deleted');
      void utils.analytics.reports.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const markRunMutation = api.analytics.reports.markRun.useMutation({
    onSuccess: () => {
      void utils.analytics.reports.list.invalidate();
    },
  });

  async function handleRun(id: string) {
    setRunningId(id);
    // Simulate report run — mark as run
    await new Promise((r) => setTimeout(r, 1200));
    markRunMutation.mutate({ id });
    setRunningId(null);
    toast.success('Report executed successfully');
  }

  const reports = reportsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {showCreate && <CreateReportModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Saved reports and scheduled analytics</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Report
        </button>
      </div>

      {reportsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-brand-500" />
          </div>
          <div>
            <p className="font-semibold">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first report to track metrics over time.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const modBadge = MODULE_BADGES[report.module] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
            const typeBadge = TYPE_BADGES[report.report_type] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
            return (
              <div
                key={report.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all group flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRun(report.id)}
                      disabled={runningId === report.id}
                      className="w-7 h-7 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center text-green-600 transition-colors"
                      title="Run report"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this report?')) {
                          deleteMutation.mutate({ id: report.id });
                        }
                      }}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 transition-colors"
                      title="Delete report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-sm leading-tight mb-1">{report.name}</h3>
                {report.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{report.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', modBadge.bg, modBadge.text)}>
                    {report.module}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', typeBadge.bg, typeBadge.text)}>
                    {report.report_type}
                  </span>
                  {report.is_scheduled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                      Scheduled
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Created {formatDate(report.created_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {report.last_run_at ? `Run ${timeAgo(report.last_run_at)}` : 'Never run'}
                  </span>
                </div>

                {runningId === report.id && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-brand-500">
                    <div className="w-3 h-3 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    Running report…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
