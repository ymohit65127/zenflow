'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, getInitials, generateAvatarColor, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
// -- Types -------------------------------------------------------------------

type EmployeeFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department_id: string;
  date_of_birth: string;
  gender: string;
  join_date: string;
  employment_type: string;
  status: string;
  position: string;
  designation: string;
  salary: string;
  currency: string;
};

const EMPTY_FORM: EmployeeFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department_id: '',
  date_of_birth: '',
  gender: '',
  join_date: new Date().toISOString().slice(0, 10),
  employment_type: 'FULL_TIME',
  status: 'ACTIVE',
  position: '',
  designation: '',
  salary: '',
  currency: 'USD',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INACTIVE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TERMINATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const EMP_TYPE_COLORS: Record<string, string> = {
  FULL_TIME: 'bg-brand-500/10 text-brand-500',
  PART_TIME: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  CONTRACT: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  FREELANCE: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  INTERN: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
};

// -- Employee Dialog ----------------------------------------------------------

function EmployeeDialog({
  open,
  onClose,
  editingId,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  departments: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const utils = api.useUtils();

  // Load employee data for editing
  const { data: editData } = api.hr.employees.get.useQuery(
    { id: editingId ?? '' },
    { enabled: !!editingId },
  );

  useEffect(() => {
    if (!editData) return;
    setForm({
      first_name: editData.first_name,
      last_name: editData.last_name,
      email: editData.email,
      phone: editData.phone ?? '',
      department_id: editData.department_id ?? '',
      date_of_birth: editData.date_of_birth ? new Date(editData.date_of_birth).toISOString().slice(0, 10) : '',
      gender: editData.gender ?? '',
      join_date: new Date(editData.join_date).toISOString().slice(0, 10),
      employment_type: editData.employment_type,
      status: editData.status,
      position: editData.position ?? '',
      designation: editData.designation ?? '',
      salary: editData.salary ? String(editData.salary) : '',
      currency: editData.currency,
    });
  }, [editData]);

  const createMutation = api.hr.employees.create.useMutation({
    onSuccess: () => {
      toast.success('Employee created successfully');
      void utils.hr.employees.list.invalidate();
      void utils.hr.employees.stats.invalidate();
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.hr.employees.update.useMutation({
    onSuccess: () => {
      toast.success('Employee updated successfully');
      void utils.hr.employees.list.invalidate();
      void utils.hr.employees.stats.invalidate();
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone || undefined,
      department_id: form.department_id || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: (form.gender as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY') || undefined,
      join_date: form.join_date,
      employment_type: form.employment_type as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERN',
      status: form.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED',
      position: form.position || undefined,
      designation: form.designation || undefined,
      salary: form.salary ? parseFloat(form.salary) : undefined,
      currency: form.currency,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (k: keyof EmployeeFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name *</label>
              <input required value={form.first_name} onChange={set('first_name')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name *</label>
              <input required value={form.last_name} onChange={set('last_name')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Doe" />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Work Email *</label>
              <input required type="email" value={form.email} onChange={set('email')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="john@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="+1 555 0000" />
            </div>
          </div>

          {/* Department & Manager */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <select value={form.department_id} onChange={set('department_id')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">— Select Department —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Designation</label>
              <input value={form.designation} onChange={set('designation')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Software Engineer" />
            </div>
          </div>

          {/* Position & Salary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Position</label>
              <input value={form.position} onChange={set('position')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Senior Developer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Salary</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={set('currency')}
                  className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-20">
                  <option>USD</option><option>EUR</option><option>GBP</option><option>INR</option>
                </select>
                <input type="number" step="0.01" value={form.salary} onChange={set('salary')}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* DOB & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Gender</label>
              <select value={form.gender} onChange={set('gender')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Join Date & Employment Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Join Date *</label>
              <input required type="date" value={form.join_date} onChange={set('join_date')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment Type</label>
              <select value={form.employment_type} onChange={set('employment_type')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="FREELANCE">Freelance</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select value={form.status} onChange={set('status')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data, isLoading } = api.hr.employees.list.useQuery({
    search: search || undefined,
    department_id: deptFilter || undefined,
    status: (statusFilter as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED') || undefined,
    page,
    limit: 20,
  });

  const { data: departments } = api.hr.departments.list.useQuery();

  const deleteMutation = api.hr.employees.delete.useMutation({
    onSuccess: () => {
      toast.success('Employee deleted');
      void utils.hr.employees.list.invalidate();
      void utils.hr.employees.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This action cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  };

  const openAdd = () => { setEditingId(null); setDialogOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };

  const deptOptions = departments ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1">
            {data ? `${data.total} employee${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search employees…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Departments</option>
          {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="p-16 text-center">
            <p className="font-medium text-muted-foreground">No employees found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting filters or add a new employee</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Department</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Designation</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Join Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((emp) => {
                    const name = `${emp.first_name} ${emp.last_name}`;
                    const color = generateAvatarColor(name);
                    return (
                      <tr key={emp.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {getInitials(name)}
                            </div>
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-xs text-muted-foreground">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{emp.employee_code}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.designation ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', EMP_TYPE_COLORS[emp.employment_type] ?? '')}>
                            {emp.employment_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[emp.status] ?? '')}>
                            {emp.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(emp.join_date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(emp.id)}
                              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id, name)}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingId={editingId}
        departments={deptOptions.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
