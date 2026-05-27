'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, BookOpen, Eye, ThumbsUp, Pencil, X, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ARCHIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// -- Article Dialog -----------------------------------------------------------

function ArticleDialog({
  open,
  onClose,
  editingId,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    tags: '',
    category_id: '',
  });

  const utils = api.useUtils();

  // Load article for editing
  const { data: editData } = api.helpdesk.kb.get.useQuery(
    { id: editingId ?? '' },
    { enabled: !!editingId },
  );

  useEffect(() => {
    if (!editData) return;
    setForm({
      title: editData.title,
      content: editData.content,
      excerpt: editData.excerpt ?? '',
      status: editData.status,
      tags: editData.tags.join(', '),
      category_id: editData.category_id ?? '',
    });
  }, [editData]);

  const createMutation = api.helpdesk.kb.create.useMutation({
    onSuccess: () => {
      toast.success('Article created');
      void utils.helpdesk.kb.list.invalidate();
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.helpdesk.kb.update.useMutation({
    onSuccess: () => {
      toast.success('Article updated');
      void utils.helpdesk.kb.list.invalidate();
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleClose = () => {
    setForm({ title: '', content: '', excerpt: '', status: 'DRAFT', tags: '', category_id: '' });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: form.title,
      content: form.content,
      excerpt: form.excerpt || undefined,
      status: form.status,
      tags,
      category_id: form.category_id || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Article' : 'New Article'}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <input required value={form.title} onChange={set('title')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="How to reset your password" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Excerpt</label>
            <input value={form.excerpt} onChange={set('excerpt')}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="Brief summary shown in article listings…" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={form.status} onChange={set('status')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <select value={form.category_id} onChange={set('category_id')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                <option value="">— Uncategorised —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tags</label>
              <input value={form.tags} onChange={set('tags')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="tag1, tag2, tag3" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Content (Markdown) *</label>
            <textarea required value={form.content} onChange={set('content')} rows={16}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              placeholder="# Article Title&#10;&#10;Write your article content here using **Markdown**…" />
            <p className="text-xs text-muted-foreground mt-1">Markdown formatting is supported</p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Article Card -------------------------------------------------------------

type ArticleItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  tags: string[];
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: Date;
  updated_at: Date;
  category_id: string | null;
};

function ArticleCard({
  article,
  onEdit,
}: {
  article: ArticleItem;
  onEdit: (id: string) => void;
}) {
  const helpfulRate =
    article.helpful_count + article.not_helpful_count > 0
      ? Math.round((article.helpful_count / (article.helpful_count + article.not_helpful_count)) * 100)
      : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[article.status] ?? '')}>
            {article.status}
          </span>
        </div>
        <button
          onClick={() => onEdit(article.id)}
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="font-semibold text-base mb-1.5 line-clamp-2 leading-snug">{article.title}</h3>

      {article.excerpt && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{article.excerpt}</p>
      )}

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {article.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{article.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {article.views}
          </span>
          {helpfulRate !== null && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" /> {helpfulRate}%
            </span>
          )}
        </div>
        <span title={formatDate(article.updated_at, 'MMM d, yyyy HH:mm')}>
          {timeAgo(article.updated_at)}
        </span>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = api.helpdesk.kb.list.useQuery({
    search: search || undefined,
    status: (statusFilter as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') || undefined,
    page,
    limit: 12,
  });

  const { data: categories } = api.helpdesk.categories.list.useQuery();

  const openCreate = () => { setEditingId(null); setDialogOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true); };

  const totalPublished = data?.items.filter((a) => a.status === 'PUBLISHED').length ?? 0;
  const totalViews = data?.items.reduce((sum, a) => sum + a.views, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Self-service articles and guides for your customers</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-4">
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-brand-500" />
          <div>
            <p className="text-lg font-bold">{data?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Articles</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <Eye className="w-5 h-5 text-cyan-500" />
          <div>
            <p className="text-lg font-bold">{totalViews}</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <ThumbsUp className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-lg font-bold">{totalPublished}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search articles…"
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Article grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium text-muted-foreground">No articles found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Try different search terms' : 'Create your first knowledge base article'}
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Article
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((article) => (
              <ArticleCard key={article.id} article={article} onEdit={openEdit} />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, data.total)} of {data.total}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ArticleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingId={editingId}
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
