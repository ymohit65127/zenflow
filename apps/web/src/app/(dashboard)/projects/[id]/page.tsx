'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Loader2, X, Users, Settings,
  List, Kanban, ChevronDown, Pencil, LayoutList,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn, formatDate, getInitials, generateAvatarColor } from '@/lib/utils';
import { TaskDetail } from '@/components/projects/task-detail';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: Date | null;
  tags: string[];
  assignments: { user_id: string; user: { id: string; name: string; avatar_url: string | null } }[];
  _count: { comments: number; subtasks: number };
};

type ProjectMember = {
  id: string;
  user_id: string;
  role: string;
  user: { id: string; name: string; avatar_url: string | null; email: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'TODO', label: 'To Do', color: 'border-t-muted-foreground' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-t-blue-500' },
  { status: 'IN_REVIEW', label: 'In Review', color: 'border-t-amber-500' },
  { status: 'DONE', label: 'Done', color: 'border-t-green-500' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-muted-foreground',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', ON_HOLD: 'On Hold', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', ARCHIVED: 'Archived',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  ON_HOLD: 'bg-amber-500/10 text-amber-600',
  COMPLETED: 'bg-brand-500/10 text-brand-600',
  CANCELLED: 'bg-red-500/10 text-red-600',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size = 'sm' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'md' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className={cn(sz, 'rounded-full object-cover ring-2 ring-background')} />
  ) : (
    <div
      className={cn(sz, 'rounded-full flex items-center justify-center text-white font-bold ring-2 ring-background')}
      style={{ backgroundColor: generateAvatarColor(name) }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Add Task Inline ──────────────────────────────────────────────────────────

function AddTaskInline({
  projectId,
  status,
  onDone,
}: {
  projectId: string;
  status: TaskStatus;
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const [title, setTitle] = useState('');

  const create = api.projects.tasks.create.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      void utils.projects.list.invalidate();
      setTitle('');
      onDone();
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ projectId, title: title.trim(), status });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder="Task title..."
        autoFocus
        className="flex-1 text-sm bg-background border border-brand-500/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
      />
      <button
        type="submit"
        disabled={create.isPending || !title.trim()}
        className="p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
      <button type="button" onClick={onDone} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
        <X className="w-4 h-4" />
      </button>
    </form>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'DONE';

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-brand-500/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', PRIORITY_COLORS[task.priority])} />
        <p className="text-sm font-medium leading-snug group-hover:text-brand-500 transition-colors line-clamp-2">
          {task.title}
        </p>
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 ml-4">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] bg-brand-500/10 text-brand-600 rounded-full px-1.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between ml-4">
        <div className="flex -space-x-1">
          {task.assignments.slice(0, 3).map((a) => (
            <Avatar key={a.user_id} name={a.user.name} avatarUrl={a.user.avatar_url} size="sm" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {task._count.comments > 0 && (
            <span className="text-[10px] text-muted-foreground">{task._count.comments} 💬</span>
          )}
          {task.due_date && (
            <span className={cn('text-[10px]', isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
              {formatDate(task.due_date, 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  tasks,
  projectId,
  onTaskClick,
}: {
  tasks: Task[];
  projectId: string;
  onTaskClick: (id: string) => void;
}) {
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)]">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex-shrink-0 w-72">
            <div className={cn('bg-muted/40 rounded-xl border-t-2 p-3', col.color, 'border border-border')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(col.status)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
                ))}
              </div>

              {addingTo === col.status ? (
                <AddTaskInline
                  projectId={projectId}
                  status={col.status}
                  onDone={() => setAddingTo(null)}
                />
              ) : (
                <button
                  onClick={() => setAddingTo(col.status)}
                  className="mt-2 w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-2 py-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  projectId,
  onTaskClick,
}: {
  tasks: Task[];
  projectId: string;
  onTaskClick: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assignees</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'DONE';
            return (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_COLORS[task.priority])} />
                    <span className="font-medium hover:text-brand-500 transition-colors">{task.title}</span>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1">
                        {task.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] bg-brand-500/10 text-brand-600 rounded-full px-1.5 py-0.5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    task.status === 'DONE' ? 'bg-green-500/10 text-green-600' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600' :
                    task.status === 'IN_REVIEW' ? 'bg-amber-500/10 text-amber-600' :
                    task.status === 'CANCELLED' ? 'bg-red-500/10 text-red-600' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs font-medium',
                    task.priority === 'URGENT' ? 'text-red-600' :
                    task.priority === 'HIGH' ? 'text-amber-600' :
                    task.priority === 'MEDIUM' ? 'text-blue-600' :
                    'text-muted-foreground'
                  )}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex -space-x-1">
                    {task.assignments.slice(0, 3).map((a) => (
                      <Avatar key={a.user_id} name={a.user.name} avatarUrl={a.user.avatar_url} size="sm" />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs', isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
                    {formatDate(task.due_date)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {adding ? (
        <div className="p-3 border-t border-border">
          <AddTaskInline projectId={projectId} status="TODO" onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 px-4 py-3 transition-colors border-t border-border"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      )}
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ project }: { project: { id: string; members: ProjectMember[] } }) {
  const utils = api.useUtils();
  const [showInvite, setShowInvite] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  const { data: orgUsers } = api.projects.getOrgUsers.useQuery();

  const addMember = api.projects.addMember.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: project.id });
      setShowInvite(false);
      setSelectedUserId('');
      toast.success('Member added');
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMember = api.projects.removeMember.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: project.id });
      toast.success('Member removed');
    },
    onError: (err) => toast.error(err.message),
  });

  const existingMemberIds = new Set(project.members.map((m) => m.user_id));
  const availableUsers = orgUsers?.filter((u) => !existingMemberIds.has(u.id)) ?? [];

  const ROLE_COLORS: Record<string, string> = {
    OWNER: 'bg-brand-500/10 text-brand-600',
    ADMIN: 'bg-violet-500/10 text-violet-600',
    MEMBER: 'bg-cyan-500/10 text-cyan-600',
    VIEWER: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Project Members ({project.members.length})</h3>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showInvite && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-medium">Add Member</h4>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">Select user...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
              className="text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => selectedUserId && addMember.mutate({ projectId: project.id, userId: selectedUserId, role: selectedRole })}
              disabled={!selectedUserId || addMember.isPending}
              className="flex items-center gap-2 text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {addMember.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add
            </button>
            <button onClick={() => setShowInvite(false)} className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {project.members.map((member, i) => (
          <div
            key={member.id}
            className={cn('flex items-center justify-between px-4 py-3', i < project.members.length - 1 && 'border-b border-border')}
          >
            <div className="flex items-center gap-3">
              {member.user ? (
                <Avatar name={member.user.name} avatarUrl={member.user.avatar_url} size="md" />
              ) : (
                <div className="w-8 h-8 bg-muted rounded-full" />
              )}
              <div>
                <p className="text-sm font-medium">{member.user?.name ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{member.user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[member.role] ?? 'bg-muted text-muted-foreground')}>
                {member.role}
              </span>
              {member.role !== 'OWNER' && (
                <button
                  onClick={() => removeMember.mutate({ projectId: project.id, userId: member.user_id })}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ project }: {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    color: string;
    start_date: Date | null;
    due_date: Date | null;
  }
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? '',
    color: project.color,
    status: project.status as 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED',
    startDate: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
    dueDate: project.due_date ? new Date(project.due_date).toISOString().split('T')[0] : '',
  });

  const COLOR_OPTIONS = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#22c55e',
    '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
  ];

  const update = api.projects.update.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: project.id });
      void utils.projects.list.invalidate();
      toast.success('Project updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      id: project.id,
      name: form.name,
      description: form.description || null,
      color: form.color,
      status: form.status,
      startDate: form.startDate ? new Date(form.startDate) : null,
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Project Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Color</label>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className={cn('w-7 h-7 rounded-full border-2 transition-all', form.color === c ? 'border-foreground scale-110' : 'border-transparent')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Start Date</label>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Due Date</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
      </div>

      <button
        type="submit"
        disabled={update.isPending}
        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
      >
        {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Changes
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'board' | 'list' | 'members' | 'settings';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('board');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: project, isLoading } = api.projects.get.useQuery({ id });

  const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
    { value: 'board', label: 'Board', icon: Kanban },
    { value: 'list', label: 'List', icon: LayoutList },
    { value: 'members', label: 'Members', icon: Users },
    { value: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 bg-muted rounded-lg" />
          <div className="h-6 bg-muted rounded w-48" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground mb-4">Project not found</p>
        <button onClick={() => router.push('/projects')} className="text-sm text-brand-500 hover:underline">
          Back to Projects
        </button>
      </div>
    );
  }

  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === 'DONE').length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/projects')}
          className="p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PROJECT_STATUS_COLORS[project.status] ?? 'bg-muted text-muted-foreground')}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>

          {project.description && (
            <p className="text-muted-foreground text-sm mt-1 ml-6">{project.description}</p>
          )}

          {/* Progress */}
          <div className="ml-6 mt-3 flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{doneTasks}/{totalTasks} tasks</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: project.color }}
                />
              </div>
            </div>
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 5).map((m) => m.user && (
                <Avatar key={m.id} name={m.user.name} avatarUrl={m.user.avatar_url} size="sm" />
              ))}
              {project.members.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground ring-2 ring-background">
                  +{project.members.length - 5}
                </div>
              )}
            </div>
            {project.due_date && (
              <span className="text-xs text-muted-foreground">
                Due {formatDate(project.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.value
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.value === 'members' && (
              <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
                {project.members.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'board' && (
        <KanbanBoard
          tasks={project.tasks as Task[]}
          projectId={project.id}
          onTaskClick={(taskId) => setSelectedTaskId(taskId)}
        />
      )}

      {tab === 'list' && (
        <ListView
          tasks={project.tasks as Task[]}
          projectId={project.id}
          onTaskClick={(taskId) => setSelectedTaskId(taskId)}
        />
      )}

      {tab === 'members' && (
        <MembersTab project={{ id: project.id, members: project.members as ProjectMember[] }} />
      )}

      {tab === 'settings' && (
        <SettingsTab project={project} />
      )}

      {/* Task Detail Slide-over */}
      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          projectId={project.id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
