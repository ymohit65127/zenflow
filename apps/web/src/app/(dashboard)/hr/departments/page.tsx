'use client';

import { useState } from 'react';
import { Building2, Plus, ChevronRight, Users, Edit, Trash2, X, Check } from 'lucide-react';
import { api } from '@/trpc/react';

type DeptNode = {
  id: string;
  name: string;
  description: string | null;
  parent_department_id: string | null;
  cost_center_code: string | null;
  is_active: boolean;
  _count: { employees: number };
  children: Array<{
    id: string;
    name: string;
    _count: { employees: number };
  }>;
};

function DeptCard({
  dept,
  onEdit,
  onDelete,
}: {
  dept: DeptNode;
  onEdit: (dept: DeptNode) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{dept.name}</h3>
            {dept.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{dept.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {dept._count.employees} employees
              </span>
              {dept.cost_center_code && (
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {dept.cost_center_code}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {dept.children.length > 0 && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle sub-departments"
            >
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          <button
            onClick={() => onEdit(dept)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Edit className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => onDelete(dept.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {expanded && dept.children.length > 0 && (
        <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/20 space-y-2">
          {dept.children.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-2 pl-3 border-l-2 border-brand-500/30"
            >
              <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">{child.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{child._count.employees} emp</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeptDialog({
  editingDept,
  departments,
  onClose,
}: {
  editingDept: DeptNode | null;
  departments: DeptNode[];
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState(editingDept?.name ?? '');
  const [description, setDescription] = useState(editingDept?.description ?? '');
  const [parent, setParent] = useState(editingDept?.parent_department_id ?? '');
  const [costCenter, setCostCenter] = useState(editingDept?.cost_center_code ?? '');

  const create = api.hr.hr_departments.create.useMutation({
    onSuccess: () => { void utils.hr.hr_departments.list.invalidate(); onClose(); },
  });
  const update = api.hr.hr_departments.update.useMutation({
    onSuccess: () => { void utils.hr.hr_departments.list.invalidate(); onClose(); },
  });

  const isPending = create.isPending || update.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingDept) {
      update.mutate({
        id: editingDept.id,
        name: name.trim(),
        description: description.trim() || null,
        parent_department_id: parent || null,
        cost_center_code: costCenter.trim() || null,
      });
    } else {
      create.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        parent_department_id: parent || undefined,
        cost_center_code: costCenter.trim() || undefined,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">{editingDept ? 'Edit Department' : 'New Department'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Parent Department</label>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">None (Top Level)</option>
              {departments
                .filter((d) => d.id !== editingDept?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Cost Center Code</label>
            <input
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              placeholder="e.g. CC-001"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {editingDept ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<DeptNode | null>(null);
  const utils = api.useUtils();

  const { data: departments = [], isLoading } = api.hr.hr_departments.list.useQuery();
  const deleteMutation = api.hr.hr_departments.delete.useMutation({
    onSuccess: () => void utils.hr.hr_departments.list.invalidate(),
  });

  function openCreate() { setEditingDept(null); setShowDialog(true); }
  function openEdit(dept: DeptNode) { setEditingDept(dept); setShowDialog(true); }
  function handleDelete(id: string) {
    if (confirm('Deactivate this department?')) {
      deleteMutation.mutate({ id });
    }
  }

  const topLevel = departments.filter((d) => !d.parent_department_id);
  const total = departments.reduce((s, d) => s + d._count.employees, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground mt-1">
            {departments.length} departments · {total} total employees
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">No departments yet</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create First Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevel.map((dept) => (
            <DeptCard
              key={dept.id}
              dept={dept}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showDialog && (
        <DeptDialog
          editingDept={editingDept}
          departments={departments}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
