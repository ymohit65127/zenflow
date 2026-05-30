'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, BookOpen, Eye, ThumbsUp, ThumbsDown, Pencil, X, ChevronLeft, ChevronRight, Tag, History, Globe, Lock } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const VISIBILITY_ICONS: Record<string, React.ElementType> = { public: Globe, agents_only: Lock, org_only: Lock };

// -- Article Dialog ----------------------------------------------------------

function ArticleDialog({ open, onClose, editingId, categories }: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({
    title: '', body: '', status: 'draft' as const, visibility: 'public' as const,
    tags: '', category_id: '', meta_description: '', change_note: '',
  });
  const utils = api.useUtils();

  const createMutation = api.helpdesk.kbV2.create.useMutation({
    onSuccess: () => { toast.success('Article created'); void utils.helpdesk.kbV2.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = api.helpdesk.kbV2.update.useMutation({
    onSuccess: () => { toast.success('Article updated'); void utils.helpdesk.kbV2.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = { title: form.title, content: form.body, status: form.status as 'draft' | 'published' | 'archived', visibility: form.visibility as 'internal' | 'external' | 'agents_only', tags, category_id: form.category_id || undefined, change_note: form.change_note || undefined };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Article' : 'New Article'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1.5">Title *</label>
            <input required value={form.title} onChange={set('title')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={set('status')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
              </select></div>
            <div><label className="block text-sm font-medium mb-1.5">Visibility</label>
              <select value={form.visibility} onChange={set('visibility')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="public">Public</option><option value="agents_only">Agents Only</option><option value="org_only">Org Only</option>
              </select></div>
            <div><label className="block text-sm font-medium mb-1.5">Category</label>
              <select value={form.category_id} onChange={set('category_id')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Tags</label>
            <input value={form.tags} onChange={set('tags')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="tag1, tag2, tag3" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Meta Description</label>
            <input value={form.meta_description} onChange={set('meta_description')} maxLength={300}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Content (Markdown) *</label>
            <textarea required value={form.body} onChange={set('body')} rows={14}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none" /></div>
          {editingId && (
            <div><label className="block text-sm font-medium mb-1.5">Change Note</label>
              <input value={form.change_note} onChange={set('change_note')} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Brief description of changes…" /></div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Article Card ------------------------------------------------------------

type ArticleItem = {
  id: string; title: string; slug: string; status: string; visibility: string;
  tags: string[]; views_count: number; helpful_count: number; not_helpful_count: number;
  created_at: Date; updated_at: Date; category_id: string | null;
  category: { id: string; name: string; color: string | null } | null;
  _count: { versions: number; feedback: number };
};

function ArticleCard({ article, onEdit }: { article: ArticleItem; onEdit: (id: string) => void }) {
  const helpfulRate = article.helpful_count + article.not_helpful_count > 0
    ? Math.round((article.helpful_count / (article.helpful_count + article.not_helpful_count)) * 100) : null;
  const VisibilityIcon = VISIBILITY_ICONS[article.visibility] ?? Globe;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[article.status] ?? '')}>{article.status}</span>
          {article.visibility !== 'public' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <VisibilityIcon className="w-3 h-3" /> {article.visibility.replace('_', ' ')}
            </span>
          )}
        </div>
        <button onClick={() => onEdit(article.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="font-semibold text-base mb-2 line-clamp-2 leading-snug">{article.title}</h3>

      {article.category && (
        <span className="inline-block px-2 py-0.5 text-xs rounded-full mb-2" style={{ backgroundColor: article.category.color ? `${article.category.color}20` : undefined, color: article.category.color ?? undefined }}>
          {article.category.name}
        </span>
      )}

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {article.tags.slice(0, 3).map((tag) => <span key={tag} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">{tag}</span>)}
          {article.tags.length > 3 && <span className="text-xs text-muted-foreground">+{article.tags.length - 3}</span>}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {article.views_count}</span>
          {helpfulRate !== null && <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {helpfulRate}%</span>}
          {article._count.versions > 0 && <span className="flex items-center gap-1"><History className="w-3.5 h-3.5" /> v{article._count.versions}</span>}
        </div>
        <span>{timeAgo(article.updated_at)}</span>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = api.helpdesk.kbV2.list.useQuery({
    search: search || undefined,
    status: statusFilter as 'draft' | 'published' | 'archived' | undefined || undefined,
    visibility: visibilityFilter as 'internal' | 'external' | 'agents_only' | undefined || undefined,
    category_id: categoryFilter || undefined,
    page,
    limit: 12,
  });

  const { data: categories } = api.helpdesk.kbV2.listCategories.useQuery();

  const flatCategories = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];

  const openCreate = () => { setEditingId(null); setDialogOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };

  const totalViews = data?.items.reduce((s, a) => s + a.views_count, 0) ?? 0;
  const totalPublished = data?.items.filter((a) => a.status === 'published').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Self-service articles with version history and feedback tracking</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: 'Total Articles', value: data?.total ?? 0, icon: BookOpen, color: 'text-brand-500' },
          { label: 'Total Views', value: totalViews, icon: Eye, color: 'text-cyan-500' },
          { label: 'Published', value: totalPublished, icon: Globe, color: 'text-green-500' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <s.icon className={cn('w-5 h-5', s.color)} />
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search articles…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
        <select value={visibilityFilter} onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Visibility</option>
          <option value="public">Public</option><option value="agents_only">Agents Only</option><option value="org_only">Org Only</option>
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
          <option value="">All Categories</option>
          {flatCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Articles grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : !data?.items.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">{search ? 'No articles match your search' : 'No articles yet'}</p>
          {!search && <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> New Article</button>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((article) => <ArticleCard key={article.id} article={article} onEdit={openEdit} />)}
          </div>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, data.total)} of {data.total}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      <ArticleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingId={editingId}
        categories={flatCategories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
