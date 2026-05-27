'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Kanban, Plus, Clock, Users, CheckCircle2, AlertTriangle,
  FolderKanban, TrendingUp, X, Loader2, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn, formatDate, getInitials, generateAvatarColor } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  ON_HOLD: 'bg-amber-500/10 text-amber-600',
  COMPLETED: 'bg-brand-500/10 text-brand-600',
  CANCELLED: 'bg-red-500/10 text-red-600',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#22c55e',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

// ─── New Project Dialog ───────────────────────────────────────────────────────

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    startDate: '',
    dueDate: '',
  });

  const create = api.projects.create.useMutation({
    onSuccess: () => {
      void utils.projects.list.invalidate();
      void utils.projects.stats.invalidate();
      toast.success('Project created');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    create.mutate({
      name: form.name.trim(),
      description: form.description || undefined,
      color: form.color,
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Project Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Website Redesign"
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description..."
              rows={3}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-all',
                    form.color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !form.name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  due_date: Date | null;
  totalTasks: number;
  doneTasks: number;
  _count: { members: number };
};

function ProjectCard({ project }: { project: ProjectListItem }) {
  const router = useRouter();
  const pct = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 0;
  const isOverdue =
    project.due_date &&
    new Date(project.due_date) < new Date() &&
    project.status !== 'COMPLETED';

  return (
    <div
      onClick={() => router.push(`/projects/${project.id}`)}
      className="bg-card border border-border rounded-2xl p-6 hover:border-brand-500/40 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate group-hover:text-brand-500 transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project.description}
            </p>
          )}
          <span
            className={cn(
              'inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium',
              STATUS_COLORS[project.status] ?? 'bg-muted text-muted-foreground'
            )}
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{project.doneTasks}/{project.totalTasks} tasks</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: project.color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {project._count.members} member{project._count.members !== 1 ? 's' : ''}
        </div>
        {project.due_date && (
          <div className={cn('flex items-center gap-1', isOverdue && 'text-red-500')}>
            {isOverdue ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            {formatDate(project.due_date)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-1 h-12 bg-muted rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-5 bg-muted rounded w-16" />
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="flex justify-between">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-8" />
        </div>
        <div className="h-1.5 bg-muted rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 bg-muted rounded w-20" />
        <div className="h-3 bg-muted rounded w-24" />
      </div>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatsCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      <p className="text-muted-foreground text-sm mt-0.5">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const { data: stats, isLoading: statsLoading } = api.projects.stats.useQuery();
  const { data: projects, isLoading: projectsLoading } = api.projects.list.useQuery({
    status: filter === 'ALL' ? undefined : filter,
  });

  const filterTabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'On Hold', value: 'ON_HOLD' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage tasks, sprints, and team work</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Total Projects"
          value={stats?.total}
          icon={FolderKanban}
          color="bg-brand-500/10 text-brand-500"
        />
        <StatsCard
          label="Active"
          value={stats?.active}
          icon={TrendingUp}
          color="bg-green-500/10 text-green-600"
        />
        <StatsCard
          label="Completed"
          value={stats?.completed}
          icon={CheckCircle2}
          color="bg-cyan-500/10 text-cyan-600"
        />
        <StatsCard
          label="Overdue"
          value={stats?.overdue}
          icon={AlertTriangle}
          color="bg-red-500/10 text-red-600"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              filter === tab.value
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {projectsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {/* New project card */}
          <button
            onClick={() => setShowNew(true)}
            className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand-500 transition-colors" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-brand-500 transition-colors">
              Create New Project
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Kanban className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">
            {filter === 'ALL' ? 'No projects yet' : `No ${STATUS_LABELS[filter]?.toLowerCase()} projects`}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            {filter === 'ALL'
              ? 'Create your first project to get started'
              : 'Try a different filter or create a new project'}
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      )}

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
