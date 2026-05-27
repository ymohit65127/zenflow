// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { DocTree } from "@/components/documents/doc-tree";
import {
  Search,
  Plus,
  Folder,
  FileText,
  Database,
  Table2,
  PenSquare,
  LayoutTemplate,
  Clock,
  FolderOpen,
  X,
  Loader2,
  Files,
  Share2,
  Star,
  Boxes,
  ChevronRight,
} from "lucide-react";

type DocumentType =
  | "DOCUMENT"
  | "FOLDER"
  | "DATABASE"
  | "SPREADSHEET"
  | "WHITEBOARD"
  | "TEMPLATE";

const TYPE_META: Record<
  DocumentType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  DOCUMENT: {
    label: "Document",
    icon: <FileText className="w-4 h-4" />,
    color: "text-muted-foreground",
  },
  FOLDER: {
    label: "Folder",
    icon: <Folder className="w-4 h-4" />,
    color: "text-amber-500",
  },
  DATABASE: {
    label: "Database",
    icon: <Database className="w-4 h-4" />,
    color: "text-brand-500",
  },
  SPREADSHEET: {
    label: "Spreadsheet",
    icon: <Table2 className="w-4 h-4" />,
    color: "text-green-500",
  },
  WHITEBOARD: {
    label: "Whiteboard",
    icon: <PenSquare className="w-4 h-4" />,
    color: "text-violet-500",
  },
  TEMPLATE: {
    label: "Template",
    icon: <LayoutTemplate className="w-4 h-4" />,
    color: "text-pink-500",
  },
};

// ── Spaces sidebar section ───────────────────────────────────────────────────

function SpacesSidebarSection() {
  const { data: spaces = [], isLoading } = api.documents.spaces.list.useQuery();

  return (
    <div className="px-2 py-2 border-t border-border">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Spaces
        </span>
        <Link
          href="/documents/spaces"
          className="text-xs text-brand-500 hover:underline"
        >
          Manage
        </Link>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        </div>
      ) : spaces.length === 0 ? (
        <Link
          href="/documents/spaces"
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Create a space
        </Link>
      ) : (
        <div className="space-y-0.5">
          {spaces.map((space) => (
            <Link
              key={space.id}
              href={`/documents?spaceId=${space.id}`}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors group"
            >
              <span className="text-base leading-none w-4 flex-shrink-0">
                {space.icon ?? <Boxes className="w-3.5 h-3.5" />}
              </span>
              <span className="flex-1 truncate">{space.name}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Starred section ──────────────────────────────────────────────────────────

function StarredSection() {
  const { data: starred = [] } = api.documents.starred.useQuery({});

  if (!starred.length) return null;

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 text-amber-500" />
        Starred
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {starred.slice(0, 6).map((doc) => {
          if (!doc) return null;
          const meta = TYPE_META[(doc.type as DocumentType) ?? "DOCUMENT"];
          return (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="bg-card border border-border rounded-xl p-3 hover:border-brand-500/30 transition-all group flex items-center gap-3"
            >
              <span className={cn("flex-shrink-0", meta.color)}>
                {doc.icon ? <span className="text-base">{doc.icon}</span> : meta.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-brand-500 transition-colors">
                  {doc.title}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(doc.updated_at)}</p>
              </div>
              <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const utils = api.useUtils();

  const { data: recent = [], isLoading: loadingRecent } =
    api.documents.recent.useQuery({});
  const { data: stats } = api.documents.stats.useQuery({});

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("Untitled");
  const [createType, setCreateType] = useState<DocumentType>("DOCUMENT");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: searchData = [] } = api.documents.search.query.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 1 }
  );

  const createMutation = api.documents.create.useMutation({
    onSuccess: (doc) => {
      toast.success("Created successfully");
      void utils.documents.list.invalidate();
      void utils.documents.recent.invalidate();
      void utils.documents.stats.invalidate();
      setShowCreate(false);
      setCreateTitle("Untitled");
      setCreateType("DOCUMENT");
      if (doc.type !== "FOLDER") {
        window.location.href = `/documents/${doc.id}`;
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const displayDocs = searchQuery.length > 1
    ? (searchData.results ?? []).map((r: { id: string; title: string; icon: string | null; updated_at: Date }) => ({ ...r, type: "DOCUMENT" as DocumentType, owner: null }))
    : recent;

  const statCards = [
    { label: "Total Documents", value: stats?.total ?? 0, icon: Files, color: "brand" },
    { label: "Folders", value: stats?.folders ?? 0, icon: FolderOpen, color: "amber" },
    { label: "Documents", value: stats?.documents ?? 0, icon: FileText, color: "cyan" },
    { label: "Shared With Me", value: stats?.sharedWithMe ?? 0, icon: Share2, color: "violet" },
  ];

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 overflow-hidden">
      {/* Sidebar — folder tree + spaces */}
      <aside className="w-60 border-r border-border bg-card flex-shrink-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <DocTree />
        </div>
        <SpacesSidebarSection />
        {/* Starred quick nav */}
        <div className="px-2 py-2 border-t border-border">
          <Link
            href="/documents/search"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Full-text search
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Documents</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Store, organise, and collaborate on documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/documents/spaces"
              className="flex items-center gap-1.5 border border-border hover:bg-muted px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Spaces
            </Link>
            <button
              onClick={() => { setCreateType("FOLDER"); setCreateTitle("New Folder"); setShowCreate(true); }}
              className="flex items-center gap-1.5 border border-border hover:bg-muted px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Folder className="w-4 h-4" />
              New Folder
            </button>
            <button
              onClick={() => { setCreateType("DOCUMENT"); setCreateTitle("Untitled"); setShowCreate(true); }}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Document
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
                s.color === "brand" && "bg-brand-500/10",
                s.color === "amber" && "bg-amber-500/10",
                s.color === "cyan" && "bg-cyan-500/10",
                s.color === "violet" && "bg-violet-500/10",
              )}>
                <s.icon
                  className={cn(
                    "w-4.5 h-4.5",
                    s.color === "brand" && "text-brand-500",
                    s.color === "amber" && "text-amber-500",
                    s.color === "cyan" && "text-cyan-500",
                    s.color === "violet" && "text-violet-500",
                  )}
                  style={{ width: "1.125rem", height: "1.125rem" }}
                />
              </div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Starred docs */}
        <StarredSection />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Document grid / list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {searchQuery.length > 1 ? "Search Results" : "Recent Documents"}
            </h2>
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
              {(["grid", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs transition-colors capitalize",
                    viewMode === mode ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {loadingRecent ? (
            <div className={cn(viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-2")}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : displayDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-brand-500" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {searchQuery.length > 1 ? "No results found" : "No documents yet"}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery.length > 1
                    ? "Try a different search term or use full-text search"
                    : "Create your first document to get started"}
                </p>
              </div>
              {searchQuery.length > 1 ? (
                <Link
                  href={`/documents/search?q=${encodeURIComponent(searchQuery)}`}
                  className="text-sm text-brand-500 hover:underline"
                >
                  Try full-text search →
                </Link>
              ) : (
                <button
                  onClick={() => { setCreateType("DOCUMENT"); setCreateTitle("Untitled"); setShowCreate(true); }}
                  className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Document
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayDocs.map((doc) => {
                const meta = TYPE_META[(doc.type as DocumentType) ?? "DOCUMENT"];
                return (
                  <Link
                    key={doc.id}
                    href={doc.type === "FOLDER" ? "#" : `/documents/${doc.id}`}
                    className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg bg-muted">
                        {doc.icon ? <span>{doc.icon}</span> : <span className={meta.color}>{meta.icon}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate group-hover:text-brand-500 transition-colors">{doc.title}</h3>
                        <span className="text-xs text-muted-foreground">{meta.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(doc.updated_at)}
                      </span>
                      {(doc as { owner?: { name: string } | null }).owner && (
                        <span className="truncate max-w-24">
                          {(doc as { owner?: { name: string } | null }).owner?.name}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {displayDocs.map((doc, idx) => {
                const meta = TYPE_META[(doc.type as DocumentType) ?? "DOCUMENT"];
                return (
                  <Link
                    key={doc.id}
                    href={doc.type === "FOLDER" ? "#" : `/documents/${doc.id}`}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group",
                      idx > 0 && "border-t border-border"
                    )}
                  >
                    <span className={cn("flex-shrink-0", meta.color)}>
                      {doc.icon ? <span className="text-base">{doc.icon}</span> : meta.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate group-hover:text-brand-500 transition-colors">{doc.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 px-2 py-0.5 bg-muted rounded-full">{meta.label}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(doc.updated_at)}
                    </span>
                    {(doc as { owner?: { name: string } | null }).owner && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 hidden xl:block">
                        {(doc as { owner?: { name: string } | null }).owner?.name}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">New Document</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <input
                  autoFocus
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && createTitle.trim()) {
                      createMutation.mutate({ title: createTitle.trim() || "Untitled", type: createType });
                    }
                  }}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(TYPE_META) as Array<[DocumentType, (typeof TYPE_META)[DocumentType]]>).map(([type, meta]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCreateType(type)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all",
                        createType === type
                          ? "border-brand-500 bg-brand-500/10 text-brand-600"
                          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span className={meta.color}>{meta.icon}</span>
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ title: createTitle.trim() || "Untitled", type: createType })}
                disabled={createMutation.isPending}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
