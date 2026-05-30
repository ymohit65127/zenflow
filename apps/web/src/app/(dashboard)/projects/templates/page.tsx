'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Plus, Trash2, LayoutTemplate, Layers, X, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const METHODOLOGY_COLORS: Record<string, string> = {
  agile: 'bg-brand-500/10 text-brand-600',
  waterfall: 'bg-blue-500/10 text-blue-600',
  hybrid: 'bg-purple-500/10 text-purple-600',
  kanban: 'bg-cyan-500/10 text-cyan-600',
};

export default function TemplatesPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    methodology: 'agile' as 'agile' | 'waterfall' | 'hybrid' | 'kanban',
    isPublic: false,
  });

  const { data: templates, isLoading } = api.projects.templates.list.useQuery({
    category: categoryFilter || undefined,
  });

  const { data: previewTemplate } = api.projects.templates.getById.useQuery(
    { id: previewId! },
    { enabled: !!previewId }
  );

  const create = api.projects.templates.create.useMutation({
    onSuccess: () => {
      void utils.projects.templates.list.invalidate();
      toast.success('Template created');
      setShowCreate(false);
      setForm({ name: '', description: '', category: '', methodology: 'agile', isPublic: false });
    },
    onError: (err) => toast.error(err.message),
  });

  const del = api.projects.templates.delete.useMutation({
    onSuccess: () => {
      void utils.projects.templates.list.invalidate();
      toast.success('Template deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      methodology: form.methodology,
      templateData: { phases: [], statuses: [], tasks: [], milestones: [] },
      isPublic: form.isPublic,
    });
  };

  // Get unique categories from templates
  const categories = [...new Set(templates?.map((t) => t.category).filter(Boolean) as string[])];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Templates</h1>
          <p className="text-muted-foreground mt-1">
            {templates?.length ?? 0} templates available
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/projects')}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Back to Projects
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        </div>
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter('')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              !categoryFilter
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                categoryFilter === cat
                  ? 'bg-brand-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Template</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Template Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Software Sprint Template"
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Software Development"
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Methodology</label>
                <select value={form.methodology} onChange={(e) => setForm({ ...form, methodology: e.target.value as typeof form.methodology })}
                  className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                  <option value="agile">Agile</option>
                  <option value="waterfall">Waterfall</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="kanban">Kanban</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Describe what this template is for..."
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="rounded" />
              <span className="text-sm">Make public (visible to all org members)</span>
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={create.isPending}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Template
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates grid */}
      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template) => {
            const tData = template.template_data as {
              phases?: unknown[];
              statuses?: unknown[];
              tasks?: unknown[];
              milestones?: unknown[];
            };

            return (
              <div
                key={template.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <LayoutTemplate className="w-4 h-4 text-brand-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      {template.category && (
                        <p className="text-xs text-muted-foreground">{template.category}</p>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                    template.methodology ? (METHODOLOGY_COLORS[template.methodology] ?? 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground'
                  )}>
                    {template.methodology ?? '—'}
                  </span>
                </div>

                {template.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                )}

                {/* Template contents summary */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  {(tData.phases?.length ?? 0) > 0 && (
                    <span>{tData.phases!.length} phases</span>
                  )}
                  {(tData.statuses?.length ?? 0) > 0 && (
                    <span>{tData.statuses!.length} statuses</span>
                  )}
                  {(tData.tasks?.length ?? 0) > 0 && (
                    <span>{tData.tasks!.length} tasks</span>
                  )}
                  {(tData.milestones?.length ?? 0) > 0 && (
                    <span>{tData.milestones!.length} milestones</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{template._count?.projects ?? 0} projects</span>
                    <span>·</span>
                    <span>{formatDate(template.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewId(template.id)}
                      className="p-1.5 text-muted-foreground hover:text-brand-500 rounded-lg hover:bg-brand-500/10 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => del.mutate({ id: template.id })}
                      className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => setShowCreate(true)}
            className="border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand-500 transition-colors" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-brand-500 transition-colors">
              Create Template
            </span>
          </button>
        </div>
      ) : !showCreate && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No templates yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Create templates to speed up project setup
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create First Template
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewId && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold">{previewTemplate.name}</h2>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {previewTemplate.description && (
                <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
              )}
              {(() => {
                const td = previewTemplate.template_data as {
                  phases?: Array<{ name: string; color: string }>;
                  statuses?: Array<{ name: string; color: string; statusType: string }>;
                  tasks?: Array<{ title: string; taskType?: string; priority?: string }>;
                  milestones?: Array<{ name: string; dueDaysFromStart: number }>;
                };
                return (
                  <div className="space-y-4">
                    {td.phases && td.phases.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Phases ({td.phases.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {td.phases.map((p, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs bg-muted rounded-full px-2.5 py-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                              {p.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {td.statuses && td.statuses.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Statuses ({td.statuses.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {td.statuses.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs bg-muted rounded-full px-2.5 py-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {td.tasks && td.tasks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Tasks ({td.tasks.length})
                        </h4>
                        <ul className="space-y-1">
                          {td.tasks.slice(0, 8).map((t, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                              {t.title}
                            </li>
                          ))}
                          {td.tasks.length > 8 && (
                            <li className="text-xs text-muted-foreground">+{td.tasks.length - 8} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex justify-end pt-2">
                <button onClick={() => setPreviewId(null)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
