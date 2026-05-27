'use client';

import { useState } from 'react';
import { ClipboardList, Plus, Edit, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/trpc/react';

type TaskItem = {
  id: string;
  title: string;
  category: string;
  assignee_role: 'hr' | 'manager' | 'it' | 'employee';
  due_after_days: number;
  is_required: boolean;
  description?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  tasks: unknown;
  _count: { onboarding_tasks: number };
};

const ROLE_COLORS: Record<string, string> = {
  hr: 'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  it: 'bg-orange-100 text-orange-700',
  employee: 'bg-green-100 text-green-700',
};

function TemplateCard({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const utils = api.useUtils();
  const tasks = (template.tasks as TaskItem[]) ?? [];

  const deleteMutation = api.hr.hr_onboarding.deleteTemplate.useMutation({
    onSuccess: () => void utils.hr.hr_onboarding.listTemplates.invalidate(),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-4 h-4 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{template.name}</h3>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tasks · {template._count.onboarding_tasks} assigned
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((p) => !p)} className="p-1.5 rounded hover:bg-muted">
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-muted">
            <Edit className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate({ id: template.id }); }}
            className="p-1.5 rounded hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {tasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No tasks in this template.</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.is_required && <span className="text-xs text-red-500">*required</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.category} · Due after {task.due_after_days}d</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[task.assignee_role] ?? ''}`}>
                  {task.assignee_role}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: Template | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const existingTasks = template ? (template.tasks as TaskItem[]) ?? [] : [];
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [tasks, setTasks] = useState<TaskItem[]>(existingTasks);
  const [newTask, setNewTask] = useState<Partial<TaskItem>>({
    title: '',
    category: 'General',
    assignee_role: 'hr',
    due_after_days: 1,
    is_required: true,
  });

  const create = api.hr.hr_onboarding.createTemplate.useMutation({
    onSuccess: () => { void utils.hr.hr_onboarding.listTemplates.invalidate(); onClose(); },
  });
  const update = api.hr.hr_onboarding.updateTemplate.useMutation({
    onSuccess: () => { void utils.hr.hr_onboarding.listTemplates.invalidate(); onClose(); },
  });

  const isPending = create.isPending || update.isPending;

  function addTask() {
    if (!newTask.title?.trim()) return;
    setTasks((t) => [...t, {
      id: crypto.randomUUID(),
      title: newTask.title!,
      category: newTask.category ?? 'General',
      assignee_role: newTask.assignee_role ?? 'hr',
      due_after_days: newTask.due_after_days ?? 1,
      is_required: newTask.is_required ?? true,
    }]);
    setNewTask({ title: '', category: 'General', assignee_role: 'hr', due_after_days: 1, is_required: true });
  }

  function removeTask(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: name.trim(), description: description.trim() || undefined, tasks };
    if (template) {
      update.mutate({ id: template.id, ...data });
    } else {
      create.mutate(data);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-lg">{template ? 'Edit Template' : 'New Onboarding Template'}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Template Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Engineering Onboarding" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none resize-none" />
          </div>

          {/* Tasks */}
          <div>
            <h3 className="font-semibold mb-3">Tasks ({tasks.length})</h3>
            {tasks.length > 0 && (
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · Day {t.due_after_days} · <span className="capitalize">{t.assignee_role}</span></p>
                    </div>
                    <button type="button" onClick={() => removeTask(t.id)} className="p-1 rounded hover:bg-muted flex-shrink-0">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add task form */}
            <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Task</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <input
                    value={newTask.title ?? ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                    placeholder="Task title"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <input
                  value={newTask.category ?? ''}
                  onChange={(e) => setNewTask((t) => ({ ...t, category: e.target.value }))}
                  placeholder="Category (e.g. IT Setup)"
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
                />
                <select
                  value={newTask.assignee_role ?? 'hr'}
                  onChange={(e) => setNewTask((t) => ({ ...t, assignee_role: e.target.value as TaskItem['assignee_role'] }))}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
                >
                  {['hr', 'manager', 'it', 'employee'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Due after:</label>
                  <input
                    type="number"
                    min={0}
                    value={newTask.due_after_days ?? 1}
                    onChange={(e) => setNewTask((t) => ({ ...t, due_after_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTask.is_required ?? true}
                    onChange={(e) => setNewTask((t) => ({ ...t, is_required: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>
              <button
                type="button"
                onClick={addTask}
                disabled={!newTask.title?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-500 text-brand-500 hover:bg-brand-50 rounded-lg text-xs font-medium disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
              {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = api.hr.hr_onboarding.listTemplates.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding Templates</h1>
          <p className="text-muted-foreground mt-1">{templates.length} templates</p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setShowDialog(true); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (templates as Template[]).length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No onboarding templates yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create a template to streamline employee onboarding</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(templates as Template[]).map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => { setEditingTemplate(t); setShowDialog(true); }}
            />
          ))}
        </div>
      )}

      {showDialog && (
        <TemplateDialog
          template={editingTemplate}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
