'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, X, Zap, CheckCircle2,
  Clock, PlayCircle, StopCircle, Calendar, Target,
  ChevronDown, ChevronUp, Flag,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn, formatDate } from '@/lib/utils';
import { TaskDetail } from '@/components/projects/task-detail';

// ─── Types ────────────────────────────────────────────────────────────────────

type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  start_date: Date | null;
  end_date: Date | null;
  completed_at: Date | null;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPRINT_STATUS_CONFIG: Record<SprintStatus, { label: string; color: string; bg: string }> = {
  PLANNED: { label: 'Planned', color: 'text-muted-foreground', bg: 'bg-muted/60' },
  ACTIVE: { label: 'Active', color: 'text-green-600', bg: 'bg-green-500/10' },
  COMPLETED: { label: 'Completed', color: 'text-brand-600', bg: 'bg-brand-500/10' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-500/10' },
};

const TASK_STATUS_COLORS: Record<string, { color: string; label: string }> = {
  TODO: { color: 'bg-muted text-muted-foreground', label: 'To Do' },
  IN_PROGRESS: { color: 'bg-blue-500/10 text-blue-600', label: 'In Progress' },
  IN_REVIEW: { color: 'bg-amber-500/10 text-amber-600', label: 'In Review' },
  DONE: { color: 'bg-green-500/10 text-green-600', label: 'Done' },
  CANCELLED: { color: 'bg-red-500/10 text-red-600', label: 'Cancelled' },
};

// ─── New Sprint Dialog ────────────────────────────────────────────────────────

function NewSprintDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });

  const create = api.projects.sprints.create.useMutation({
    onSuccess: () => {
      void utils.projects.sprints.list.invalidate({ projectId });
      toast.success('Sprint created');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    create.mutate({
      projectId,
      name: form.name.trim(),
      goal: form.goal || undefined,
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      endDate: form.endDate ? new Date(form.endDate) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">New Sprint</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Sprint Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sprint 1"
              autoFocus
              required
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Sprint Goal</label>
            <textarea
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="What do you want to achieve?"
              rows={2}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
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
              <label className="block text-sm font-medium mb-1.5">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

function SprintCard({
  sprint,
  projectId,
  onTaskClick,
  tasks,
}: {
  sprint: Sprint;
  projectId: string;
  onTaskClick: (id: string) => void;
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    sprint_id: string | null;
    assignments: { user_id: string; user: { name: string; avatar_url: string | null } }[];
  }[];
}) {
  const utils = api.useUtils();
  const [expanded, setExpanded] = useState(sprint.status === 'ACTIVE');
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const startSprint = api.projects.sprints.start.useMutation({
    onSuccess: () => {
      void utils.projects.sprints.list.invalidate({ projectId });
      toast.success('Sprint started');
    },
    onError: (err) => toast.error(err.message),
  });

  const completeSprint = api.projects.sprints.complete.useMutation({
    onSuccess: () => {
      void utils.projects.sprints.list.invalidate({ projectId });
      toast.success('Sprint completed');
    },
    onError: (err) => toast.error(err.message),
  });

  const createTask = api.projects.tasks.create.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      void utils.projects.sprints.list.invalidate({ projectId });
      setNewTaskTitle('');
      setAddingTask(false);
      toast.success('Task added to sprint');
    },
    onError: (err) => toast.error(err.message),
  });

  const statusConfig = SPRINT_STATUS_CONFIG[sprint.status];
  const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
  const doneCount = sprintTasks.filter((t) => t.status === 'DONE').length;
  const pct = sprintTasks.length > 0 ? Math.round((doneCount / sprintTasks.length) * 100) : 0;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask.mutate({ projectId, title: newTaskTitle.trim(), sprintId: sprint.id, status: 'TODO' });
  };

  const PRIORITY_DOTS: Record<string, string> = {
    LOW: 'bg-muted-foreground',
    MEDIUM: 'bg-blue-500',
    HIGH: 'bg-amber-500',
    URGENT: 'bg-red-500',
  };

  return (
    <div className={cn(
      'border border-border rounded-2xl overflow-hidden',
      sprint.status === 'ACTIVE' && 'border-green-500/30 shadow-md shadow-green-500/5'
    )}>
      {/* Sprint Header */}
      <div
        className={cn('flex items-center gap-4 px-5 py-4 cursor-pointer', statusConfig.bg)}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className={cn('w-4 h-4', statusConfig.color)} />
            <h3 className="font-semibold text-sm">{sprint.name}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusConfig.bg, statusConfig.color, 'border border-current/20')}>
              {statusConfig.label}
            </span>
            {sprint.status === 'ACTIVE' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
            )}
          </div>

          {sprint.goal && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 ml-6">
              <Target className="w-3 h-3" /> {sprint.goal}
            </p>
          )}

          <div className="ml-6 mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {sprint.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(sprint.start_date, 'MMM d')}
                  {sprint.end_date && ` → ${formatDate(sprint.end_date, 'MMM d, yyyy')}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {Object.entries(sprint.tasksByStatus).map(([status, count]) => (
                count > 0 && (
                  <span
                    key={status}
                    className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', TASK_STATUS_COLORS[status]?.color ?? 'bg-muted text-muted-foreground')}
                  >
                    {count} {TASK_STATUS_COLORS[status]?.label ?? status}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress */}
          <div className="text-right">
            <p className="text-xs font-semibold">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">{doneCount}/{sprintTasks.length}</p>
          </div>

          {/* Action buttons */}
          {sprint.status === 'PLANNED' && (
            <button
              onClick={(e) => { e.stopPropagation(); startSprint.mutate({ id: sprint.id }); }}
              disabled={startSprint.isPending}
              className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {startSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              Start Sprint
            </button>
          )}

          {sprint.status === 'ACTIVE' && (
            <button
              onClick={(e) => { e.stopPropagation(); completeSprint.mutate({ id: sprint.id }); }}
              disabled={completeSprint.isPending}
              className="flex items-center gap-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {completeSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Complete Sprint
            </button>
          )}

          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Sprint Body */}
      {expanded && (
        <div className="bg-card border-t border-border">
          {/* Progress bar */}
          {sprintTasks.length > 0 && (
            <div className="px-5 py-3 border-b border-border">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Tasks */}
          <div className="divide-y divide-border">
            {sprintTasks.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Flag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tasks in this sprint</p>
              </div>
            ) : (
              sprintTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority] ?? 'bg-muted-foreground')} />
                  <span className="flex-1 text-sm">{task.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', TASK_STATUS_COLORS[task.status]?.color ?? 'bg-muted text-muted-foreground')}>
                      {TASK_STATUS_COLORS[task.status]?.label ?? task.status}
                    </span>
                    <div className="flex -space-x-1">
                      {task.assignments.slice(0, 2).map((a) => (
                        a.user.avatar_url ? (
                          <img
                            key={a.user_id}
                            src={a.user.avatar_url}
                            alt={a.user.name}
                            className="w-5 h-5 rounded-full ring-1 ring-background object-cover"
                          />
                        ) : (
                          <div
                            key={a.user_id}
                            className="w-5 h-5 rounded-full ring-1 ring-background flex items-center justify-center text-[8px] text-white font-bold"
                            style={{ backgroundColor: '#6366f1' }}
                          >
                            {a.user.name[0]?.toUpperCase()}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Task inline */}
          {(sprint.status === 'PLANNED' || sprint.status === 'ACTIVE') && (
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              {addingTask ? (
                <form onSubmit={handleAddTask} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setAddingTask(false)}
                    placeholder="New task title..."
                    autoFocus
                    className="flex-1 text-sm bg-background border border-brand-500/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  <button
                    type="submit"
                    disabled={createTask.isPending || !newTaskTitle.trim()}
                    className="p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingTask(false)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add task to sprint
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Backlog ──────────────────────────────────────────────────────────────────

function BacklogSection({
  tasks,
  projectId,
  onTaskClick,
}: {
  tasks: { id: string; title: string; status: TaskStatus; priority: string; sprint_id: string | null }[];
  projectId: string;
  onTaskClick: (id: string) => void;
}) {
  const backlogTasks = tasks.filter((t) => !t.sprint_id);
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const utils = api.useUtils();

  const create = api.projects.tasks.create.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      setTitle('');
      setAdding(false);
      toast.success('Task added to backlog');
    },
    onError: (err) => toast.error(err.message),
  });

  const PRIORITY_DOTS: Record<string, string> = {
    LOW: 'bg-muted-foreground', MEDIUM: 'bg-blue-500', HIGH: 'bg-amber-500', URGENT: 'bg-red-500',
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 bg-muted/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Backlog</h3>
          <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
            {backlogTasks.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="bg-card border-t border-border">
          {backlogTasks.length === 0 && !adding ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">Backlog is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {backlogTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority] ?? 'bg-muted-foreground')} />
                  <span className="flex-1 text-sm">{task.title}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', TASK_STATUS_COLORS[task.status]?.color ?? 'bg-muted text-muted-foreground')}>
                    {TASK_STATUS_COLORS[task.status]?.label ?? task.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-border bg-muted/10">
            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) create.mutate({ projectId, title: title.trim(), status: 'TODO' });
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
                  placeholder="Backlog task title..."
                  autoFocus
                  className="flex-1 text-sm bg-background border border-brand-500/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <button type="submit" disabled={create.isPending || !title.trim()} className="p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50">
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-4 h-4" /> Add to backlog
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SprintsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = api.projects.get.useQuery({ id: projectId });
  const { data: sprints, isLoading: sprintsLoading } = api.projects.sprints.list.useQuery({ projectId });

  const isLoading = projectLoading || sprintsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const activeSprint = sprints?.find((s) => s.status === 'ACTIVE');
  const plannedSprints = sprints?.filter((s) => s.status === 'PLANNED') ?? [];
  const completedSprints = sprints?.filter((s) => s.status === 'COMPLETED') ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{project.name} — Sprints</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {sprints?.length ?? 0} sprints · {project.tasks.length} total tasks
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewSprint(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Sprint
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeSprint ? 1 : 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Sprint</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{plannedSprints.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Planned</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">{completedSprints.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
        </div>
      </div>

      {/* Sprint List */}
      {sprints && sprints.length > 0 ? (
        <div className="space-y-4">
          {/* Active sprint first */}
          {activeSprint && (
            <SprintCard
              key={activeSprint.id}
              sprint={activeSprint}
              projectId={projectId}
              onTaskClick={setSelectedTaskId}
              tasks={project.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status as TaskStatus,
                priority: t.priority,
                sprint_id: (t as { sprint_id?: string | null }).sprint_id ?? null,
                assignments: t.assignments,
              }))}
            />
          )}

          {/* Planned sprints */}
          {plannedSprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              projectId={projectId}
              onTaskClick={setSelectedTaskId}
              tasks={project.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status as TaskStatus,
                priority: t.priority,
                sprint_id: (t as { sprint_id?: string | null }).sprint_id ?? null,
                assignments: t.assignments,
              }))}
            />
          ))}

          {/* Completed sprints */}
          {completedSprints.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Completed ({completedSprints.length})
              </h3>
              <div className="space-y-3">
                {completedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    projectId={projectId}
                    onTaskClick={setSelectedTaskId}
                    tasks={project.tasks.map((t) => ({
                      id: t.id,
                      title: t.title,
                      status: t.status as TaskStatus,
                      priority: t.priority,
                      sprint_id: (t as { sprint_id?: string | null }).sprint_id ?? null,
                      assignments: t.assignments,
                    }))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No sprints yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Create your first sprint to start planning</p>
          <button
            onClick={() => setShowNewSprint(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Sprint
          </button>
        </div>
      )}

      {/* Backlog */}
      <BacklogSection
        tasks={project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status as TaskStatus,
          priority: t.priority,
          sprint_id: (t as { sprint_id?: string | null }).sprint_id ?? null,
        }))}
        projectId={projectId}
        onTaskClick={setSelectedTaskId}
      />

      {showNewSprint && <NewSprintDialog projectId={projectId} onClose={() => setShowNewSprint(false)} />}

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
