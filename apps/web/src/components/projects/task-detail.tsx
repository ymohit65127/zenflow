'use client';

import { useState, useEffect } from 'react';
import {
  X, ChevronDown, User, Calendar, Hash, Tag, Loader2,
  MessageSquare, Send, Clock, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo, getInitials, generateAvatarColor } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TaskType = 'TASK' | 'BUG' | 'STORY' | 'EPIC' | 'SUBTASK';

type AssignedUser = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type TaskDetailProps = {
  taskId: string;
  projectId: string;
  onClose: () => void;
  onUpdate?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'TODO', label: 'To Do', color: 'text-muted-foreground' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'text-blue-600' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'text-amber-600' },
  { value: 'DONE', label: 'Done', color: 'text-green-600' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'text-red-600' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string; dot: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-600', dot: 'bg-blue-500' },
  { value: 'HIGH', label: 'High', color: 'text-amber-600', dot: 'bg-amber-500' },
  { value: 'URGENT', label: 'Urgent', color: 'text-red-600', dot: 'bg-red-500' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'TASK', label: 'Task' },
  { value: 'BUG', label: 'Bug' },
  { value: 'STORY', label: 'Story' },
  { value: 'EPIC', label: 'Epic' },
  { value: 'SUBTASK', label: 'Subtask' },
];

// ─── Mini Select ─────────────────────────────────────────────────────────────

function Select<T extends string>({
  value,
  options,
  onChange,
  renderOption,
  renderValue,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  renderOption?: (o: { value: T; label: string }) => React.ReactNode;
  renderValue?: (v: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:border-brand-500/50 transition-colors bg-background"
      >
        {renderValue ? renderValue(value) : options.find((o) => o.value === value)?.label ?? value}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[140px] bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                opt.value === value && 'bg-brand-500/5 text-brand-500'
              )}
            >
              {renderOption ? renderOption(opt) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 'sm' }: { user: AssignedUser; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return user.avatar_url ? (
    <img
      src={user.avatar_url}
      alt={user.name}
      className={cn(sz, 'rounded-full object-cover')}
    />
  ) : (
    <div
      className={cn(sz, 'rounded-full flex items-center justify-center text-white font-medium')}
      style={{ backgroundColor: generateAvatarColor(user.name) }}
    >
      {getInitials(user.name)}
    </div>
  );
}

// ─── Comment Section ──────────────────────────────────────────────────────────

function CommentSection({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [content, setContent] = useState('');
  const utils = api.useUtils();

  const { data: comments, isLoading } = api.projects.tasks.getComments.useQuery({ taskId });

  const addComment = api.projects.tasks.comment.useMutation({
    onSuccess: () => {
      void utils.projects.tasks.getComments.invalidate({ taskId });
      setContent('');
      toast.success('Comment added');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addComment.mutate({ taskId, content: content.trim() });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Comments {comments ? `(${comments.length})` : ''}
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-12 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {comment.user ? (
                <Avatar user={comment.user as AssignedUser} size="md" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {comment.user?.name ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground bg-muted rounded-xl px-3 py-2">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No comments yet. Be the first to comment.</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        />
        <button
          type="submit"
          disabled={addComment.isPending || !content.trim()}
          className="p-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {addComment.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TaskDetail({ taskId, projectId, onClose, onUpdate }: TaskDetailProps) {
  const utils = api.useUtils();

  const { data: project, isLoading } = api.projects.get.useQuery({ id: projectId });
  const { data: orgUsers } = api.projects.getOrgUsers.useQuery();

  const task = project?.tasks.find((t) => t.id === taskId);

  // Local editable state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task?.id]);

  const updateTask = api.projects.tasks.update.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      void utils.projects.list.invalidate();
      onUpdate?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const assignTask = api.projects.tasks.assign.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      toast.success('Assignee updated');
    },
    onError: (err) => toast.error(err.message),
  });

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-end bg-black/40 backdrop-blur-sm">
        <div className="w-full md:w-[480px] h-full md:h-full bg-card border-l border-border flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          ) : (
            <p className="text-muted-foreground">Task not found</p>
          )}
        </div>
      </div>
    );
  }

  const assignedUserIds = new Set(task.assignments.map((a) => a.user_id));

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (title.trim() && title !== task.title) {
      updateTask.mutate({ id: taskId, title: title.trim() });
      toast.success('Title updated');
    } else {
      setTitle(task.title);
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task.description ?? '')) {
      updateTask.mutate({ id: taskId, description: description || null });
      toast.success('Description updated');
    }
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ id: taskId, status });
    toast.success(`Status changed to ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`);
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTask.mutate({ id: taskId, priority });
    toast.success(`Priority set to ${priority.toLowerCase()}`);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...task.tags, tagInput.trim()];
      updateTask.mutate({ id: taskId, tags: newTags });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateTask.mutate({ id: taskId, tags: task.tags.filter((t) => t !== tag) });
  };

  const handleToggleAssignee = (userId: string) => {
    const action = assignedUserIds.has(userId) ? 'remove' : 'add';
    assignTask.mutate({ taskId, userId, action });
  };

  const priorityInfo = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[560px] bg-card border-l border-border flex flex-col h-full overflow-hidden shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md bg-muted', statusInfo?.color)}>
              {statusInfo?.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {TYPE_OPTIONS.find((t) => t.value === task.type)?.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
                autoFocus
                className="w-full text-xl font-semibold bg-transparent border-b-2 border-brand-500 focus:outline-none pb-1"
              />
            ) : (
              <h2
                className="text-xl font-semibold cursor-text hover:text-brand-500 transition-colors"
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap gap-2">
            <Select<TaskStatus>
              value={task.status}
              options={STATUS_OPTIONS}
              onChange={handleStatusChange}
              renderValue={(v) => {
                const info = STATUS_OPTIONS.find((s) => s.value === v);
                return <span className={cn('font-medium', info?.color)}>{info?.label}</span>;
              }}
            />
            <Select<TaskPriority>
              value={task.priority}
              options={PRIORITY_OPTIONS}
              onChange={handlePriorityChange}
              renderValue={(v) => {
                const info = PRIORITY_OPTIONS.find((p) => p.value === v);
                return (
                  <span className={cn('flex items-center gap-1.5', info?.color)}>
                    <span className={cn('w-2 h-2 rounded-full', info?.dot)} />
                    {info?.label}
                  </span>
                );
              }}
              renderOption={(opt) => {
                const info = PRIORITY_OPTIONS.find((p) => p.value === opt.value);
                return (
                  <span className={cn('flex items-center gap-1.5', info?.color)}>
                    <span className={cn('w-2 h-2 rounded-full', info?.dot)} />
                    {opt.label}
                  </span>
                );
              }}
            />
            <Select<TaskType>
              value={task.type}
              options={TYPE_OPTIONS}
              onChange={(type) => updateTask.mutate({ id: taskId, type })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              rows={4}
              className="w-full text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Due date */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Due Date
              </label>
              <input
                type="date"
                defaultValue={
                  task.due_date
                    ? new Date(task.due_date).toISOString().split('T')[0]
                    : ''
                }
                onBlur={(e) =>
                  updateTask.mutate({
                    id: taskId,
                    dueDate: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            {/* Story Points */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Hash className="w-3 h-3" /> Story Points
              </label>
              <input
                type="number"
                min={0}
                defaultValue={task.story_points ?? ''}
                placeholder="0"
                onBlur={(e) =>
                  updateTask.mutate({
                    id: taskId,
                    storyPoints: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
              <User className="w-3 h-3" /> Assignees
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {task.assignments.map((a) => (
                <div
                  key={a.user_id}
                  className="flex items-center gap-1.5 bg-muted rounded-full pl-1 pr-2 py-0.5"
                >
                  <Avatar user={a.user as AssignedUser} />
                  <span className="text-xs">{a.user.name}</span>
                  <button
                    onClick={() => handleToggleAssignee(a.user_id)}
                    className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {orgUsers && (
              <div className="flex flex-wrap gap-1.5">
                {orgUsers
                  .filter((u) => !assignedUserIds.has(u.id))
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleToggleAssignee(u.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-brand-500/50 rounded-full px-2 py-1 transition-colors"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: generateAvatarColor(u.name) }}
                      >
                        {getInitials(u.name)}
                      </div>
                      {u.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs bg-brand-500/10 text-brand-600 rounded-full px-2 py-0.5"
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter..."
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-4">
            <span>Created by {task.creator.name}</span>
            {task.due_date && (
              <span className={cn('flex items-center gap-1', new Date(task.due_date) < new Date() && task.status !== 'DONE' && 'text-red-500')}>
                <Clock className="w-3 h-3" />
                Due {formatDate(task.due_date)}
              </span>
            )}
            {task._count.comments > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {task._count.comments}
              </span>
            )}
          </div>

          {/* Comments */}
          <CommentSection taskId={taskId} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
