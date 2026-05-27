'use client';

import { api } from '@/trpc/react';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, FileText, Eye, Copy, Trash2, Settings, Users,
  Globe, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  DRAFT: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Draft' },
  PUBLISHED: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Published' },
  CLOSED: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'Closed' },
  ARCHIVED: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Archived' },
} as const;

type FormStatus = keyof typeof STATUS_STYLES;

export function FormsListClient() {
  const router = useRouter();
  const utils = api.useUtils();

  const formsQuery = api.forms.list.useQuery();

  const createMutation = api.forms.create.useMutation({
    onSuccess: (form) => {
      toast.success('Form created');
      void utils.forms.list.invalidate();
      router.push(`/forms/${form.id}/builder`);
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = api.forms.duplicate.useMutation({
    onSuccess: (form) => {
      toast.success('Form duplicated');
      void utils.forms.list.invalidate();
      router.push(`/forms/${form.id}/builder`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.forms.delete.useMutation({
    onSuccess: () => {
      toast.success('Form archived');
      void utils.forms.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = api.forms.publish.useMutation({
    onSuccess: () => {
      toast.success('Form published');
      void utils.forms.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = api.forms.unpublish.useMutation({
    onSuccess: () => {
      toast.success('Form unpublished');
      void utils.forms.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleNewForm() {
    createMutation.mutate({ title: 'Untitled Form' });
  }

  const forms = formsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forms Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design and publish forms for data collection
          </p>
        </div>
        <button
          onClick={handleNewForm}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {createMutation.isPending ? 'Creating…' : 'New Form'}
        </button>
      </div>

      {formsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <FileText className="w-8 h-8 text-brand-500" />
          </div>
          <div>
            <p className="font-semibold">No forms yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first form to start collecting responses.
            </p>
          </div>
          <button
            onClick={handleNewForm}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Create Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => {
            const statusStyle = STATUS_STYLES[form.status as FormStatus] ?? STATUS_STYLES.DRAFT;
            return (
              <div
                key={form.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all group flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusStyle.bg, statusStyle.text)}>
                      {statusStyle.label}
                    </span>
                    {form.is_public ? (
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{form.title}</h3>
                {form.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{form.description}</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto mb-4">
                  <span className="flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    {form._count.fields} fields
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {form._count.submissions} responses
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  Created {formatDate(form.created_at)}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/forms/${form.id}/builder`}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 transition-colors font-medium"
                  >
                    <Settings className="w-3 h-3" />
                    Edit
                  </Link>
                  <Link
                    href={`/forms/${form.id}/submissions`}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    Responses
                  </Link>
                  {form.status === 'PUBLISHED' && (
                    <Link
                      href={`/forms/${form.slug}`}
                      target="_blank"
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-medium"
                    >
                      <Globe className="w-3 h-3" />
                      View
                    </Link>
                  )}
                  {form.status === 'DRAFT' && (
                    <button
                      onClick={() => publishMutation.mutate({ id: form.id })}
                      disabled={publishMutation.isPending}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-medium disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  {form.status === 'PUBLISHED' && (
                    <button
                      onClick={() => unpublishMutation.mutate({ id: form.id })}
                      disabled={unpublishMutation.isPending}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors font-medium disabled:opacity-50"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => duplicateMutation.mutate({ id: form.id })}
                    disabled={duplicateMutation.isPending}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-medium disabled:opacity-50"
                    title="Duplicate"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Archive this form? It will be hidden from the list.')) {
                        deleteMutation.mutate({ id: form.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium disabled:opacity-50"
                    title="Archive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
