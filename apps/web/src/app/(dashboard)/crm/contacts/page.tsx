'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { cn, formatDate, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Users, Plus, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Mail, Phone, Building2, Tag, User,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface ContactFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile: string;
  company: string;
  title: string;
  department: string;
  tags: string;
  notes: string;
  status: ContactStatus;
}

const emptyForm: ContactFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  company: '',
  title: '',
  department: '',
  tags: '',
  notes: '',
  status: 'ACTIVE',
};

// ─── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContactStatus }) {
  const cls =
    status === 'ACTIVE'
      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
      : status === 'INACTIVE'
      ? 'bg-muted text-muted-foreground'
      : 'bg-red-500/10 text-red-600 dark:text-red-400';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Contact form dialog ────────────────────────────────────────────────────

function ContactFormDialog({
  open,
  onClose,
  editId,
  initialValues,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editId?: string;
  initialValues?: Partial<ContactFormState>;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<ContactFormState>({ ...emptyForm, ...initialValues });

  const utils = api.useUtils();

  const create = api.crm.contacts.create.useMutation({
    onSuccess: () => {
      toast.success('Contact created successfully');
      void utils.crm.contacts.list.invalidate();
      void utils.crm.contacts.count.invalidate();
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const update = api.crm.contacts.update.useMutation({
    onSuccess: () => {
      toast.success('Contact updated successfully');
      void utils.crm.contacts.list.invalidate();
      void utils.crm.contacts.count.invalidate();
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = { ...form, tags, email: form.email || undefined };
    if (editId) {
      update.mutate({ id: editId, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  const set = (k: keyof ContactFormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (!open) return null;

  const isLoading = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-semibold text-lg">{editId ? 'Edit Contact' : 'Add New Contact'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name <span className="text-red-500">*</span></label>
              <input
                required
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="john@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="+1 555-0100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Mobile</label>
              <input
                value={form.mobile}
                onChange={(e) => set('mobile', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="+1 555-0101"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Company</label>
              <input
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Job Title</label>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="CEO"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Department</label>
            <input
              value={form.department}
              onChange={(e) => set('department', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="Sales"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="vip, enterprise, decision-maker"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as ContactStatus)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : editId ? 'Update Contact' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ──────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  contactName,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contactName: string;
  isPending: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-lg mb-2">Delete Contact</h3>
        <p className="text-muted-foreground text-sm mb-6">
          Are you sure you want to delete <strong>{contactName}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<{ id: string; values: ContactFormState } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const utils = api.useUtils();

  const { data: contacts, isLoading } = api.crm.contacts.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const { data: counts } = api.crm.contacts.count.useQuery({});

  const deleteContact = api.crm.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success('Contact deleted');
      void utils.crm.contacts.list.invalidate();
      void utils.crm.contacts.count.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (c: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    company: string | null;
    title: string | null;
    department: string | null;
    tags: string[];
    notes: string | null;
    status: ContactStatus;
  }) => {
    setEditContact({
      id: c.id,
      values: {
        first_name: c.first_name,
        last_name: c.last_name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        company: c.company ?? '',
        title: c.title ?? '',
        department: c.department ?? '',
        tags: c.tags.join(', '),
        notes: c.notes ?? '',
        status: c.status,
      },
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditContact(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage all your contacts</p>
        </div>
        <button
          onClick={() => { setEditContact(null); setDialogOpen(true); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-border">
        {[
          { href: '/crm', label: 'Overview' },
          { href: '/crm/contacts', label: 'Contacts', active: true },
          { href: '/crm/leads', label: 'Leads' },
          { href: '/crm/deals', label: 'Deals' },
          { href: '/crm/activities', label: 'Activities' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              link.active
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: counts?.total ?? '—', color: 'text-foreground' },
          { label: 'Active', value: counts?.active ?? '—', color: 'text-green-600' },
          { label: 'Inactive', value: counts?.inactive ?? '—', color: 'text-muted-foreground' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <span className={cn('text-lg font-bold', s.color)}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, email, company..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ContactStatus | ''); setPage(0); }}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 sm:w-40"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="h-4 w-24 bg-muted rounded hidden sm:block" />
                <div className="h-6 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : !contacts || contacts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-base mb-1">No contacts found</p>
            <p className="text-sm">
              {search || statusFilter ? 'Try adjusting your filters.' : 'Add your first contact to get started.'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => { setEditContact(null); setDialogOpen(true); }}
                className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Contact
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-4 items-center px-6 py-3 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div className="w-9" />
              <div>Name</div>
              <div>Contact</div>
              <div>Company</div>
              <div>Status</div>
              <div>Created</div>
              <div>Actions</div>
            </div>

            <div className="divide-y divide-border">
              {contacts.map((contact) => {
                const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim();
                const initials = getInitials((fullName || contact.email) ?? 'N');
                const avatarColor = generateAvatarColor(contact.id);
                return (
                  <div
                    key={contact.id}
                    className="flex flex-col lg:grid lg:grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-2 lg:gap-4 items-start lg:items-center px-6 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>

                    {/* Name + tags */}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{fullName}</p>
                      {contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded text-xs">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{contact.tags.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="min-w-0 space-y-0.5">
                      {contact.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          {contact.phone}
                        </p>
                      )}
                    </div>

                    {/* Company */}
                    <div className="min-w-0">
                      {contact.company ? (
                        <p className="text-sm flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{contact.company}</span>
                        </p>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                      {contact.title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.title}</p>}
                    </div>

                    {/* Status */}
                    <StatusBadge status={contact.status} />

                    {/* Date */}
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(contact.created_at)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(contact)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit contact"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: contact.id, name: fullName })}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, (counts?.total ?? 0))} of {counts?.total ?? '?'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium text-foreground">{page + 1}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={contacts.length < PAGE_SIZE}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <ContactFormDialog
        open={dialogOpen}
        onClose={closeDialog}
        editId={editContact?.id}
        initialValues={editContact?.values}
        onSuccess={closeDialog}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteContact.mutate({ id: deleteTarget.id })}
        contactName={deleteTarget?.name ?? ''}
        isPending={deleteContact.isPending}
      />
    </div>
  );
}
