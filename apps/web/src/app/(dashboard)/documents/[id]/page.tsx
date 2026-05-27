"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { DocTree } from "@/components/documents/doc-tree";
import { BlockEditor } from "@/components/documents/editor/BlockEditor";
import { VersionHistorySidebar } from "@/components/documents/VersionHistorySidebar";
import { CommentsPanel } from "@/components/documents/CommentsPanel";
import {
  ArrowLeft,
  Share2,
  Clock,
  X,
  Loader2,
  ChevronRight,
  Info,
  Check,
  GitBranch,
  MessageSquare,
  History,
  Star,
  Eye,
  Pencil,
  Shield,
  Download,
} from "lucide-react";

type SharePermission = "VIEW" | "COMMENT" | "EDIT" | "MANAGE";

const PERMISSION_META: Record<SharePermission, { label: string; icon: React.ReactNode }> = {
  VIEW: { label: "Can view", icon: <Eye className="w-3.5 h-3.5" /> },
  COMMENT: { label: "Can comment", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  EDIT: { label: "Can edit", icon: <Pencil className="w-3.5 h-3.5" /> },
  MANAGE: { label: "Manager", icon: <Shield className="w-3.5 h-3.5" /> },
};

type RightPanel = "info" | "versions" | "comments" | null;

export default function DocumentEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const utils = api.useUtils();

  const { data: doc, isLoading } = api.documents.get.useQuery({ id });
  const { data: shares = [] } = api.documents.getShares.useQuery({ documentId: id });

  // ── Local state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUserId, setShareUserId] = useState("");
  const [sharePermission, setSharePermission] = useState<SharePermission>("VIEW");
  const [isStarred, setIsStarred] = useState(false);
  const [previewContent, setPreviewContent] = useState<Record<string, unknown> | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
    }
  }, [doc]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const updateMutation = api.documents.update.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setIsDirty(false);
      void utils.documents.get.invalidate({ id });
      void utils.documents.recent.invalidate();
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => setSaveStatus("idle"),
  });

  const saveVersionMutation = api.documents.versions.save.useMutation({
    onSuccess: () => {
      toast.success("Version saved");
      void utils.documents.versions.list.invalidate({ documentId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  const shareMutation = api.documents.share.useMutation({
    onSuccess: () => {
      toast.success("Document shared");
      void utils.documents.getShares.invalidate({ documentId: id });
      setShareUserId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const favoriteMutation = api.documents.favorites.toggle.useMutation({
    onSuccess: (data) => {
      setIsStarred(data.favorited);
      toast.success(data.favorited ? "Added to starred" : "Removed from starred");
    },
    onError: (e) => toast.error(e.message),
  });

  const exportMarkdownQuery = api.documents.export.markdown.useQuery(
    { documentId: id },
    { enabled: false }
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const saveTitle = useCallback(
    (newTitle: string) => {
      if (!isDirty) return;
      setSaveStatus("saving");
      updateMutation.mutate({ id, title: newTitle.trim() || "Untitled" });
    },
    [id, isDirty, updateMutation]
  );

  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveTitle(title), 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, title, saveTitle]);

  function handleTitleChange(val: string) {
    setTitle(val);
    setIsDirty(true);
    setSaveStatus("idle");
  }

  function handleContentChange(content: Record<string, unknown>) {
    setSaveStatus("saving");
  }

  function togglePanel(panel: RightPanel) {
    setRightPanel((prev) => (prev === panel ? null : panel));
  }

  async function handleExportMarkdown() {
    const result = await exportMarkdownQuery.refetch();
    if (result.data) {
      const blob = new Blob([result.data.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Document not found.</p>
        <Link href="/documents" className="text-brand-500 text-sm hover:underline mt-2 inline-block">
          Back to documents
        </Link>
      </div>
    );
  }

  const initialContent = (previewContent ?? (doc.content as Record<string, unknown> | null));

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 overflow-hidden">
      {/* Doc tree sidebar */}
      <aside className="w-60 border-r border-border bg-card flex-shrink-0 overflow-hidden hidden xl:flex flex-col">
        <DocTree />
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card flex-shrink-0">
          <Link href="/documents" className="text-muted-foreground hover:text-foreground transition-colors xl:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
            <Link href="/documents" className="hover:text-foreground transition-colors hidden sm:block">Documents</Link>
            {(doc as { parent?: { title: string } | null }).parent && (
              <>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
                <span className="hidden sm:block truncate">{(doc as { parent?: { title: string } | null }).parent?.title}</span>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
            <span className="text-foreground font-medium truncate">{doc.title}</span>
          </div>

          {/* Save status */}
          <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
            {saveStatus === "saving" && (
              <><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Saving…</span></>
            )}
            {saveStatus === "saved" && (
              <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600">Saved</span></>
            )}
            {saveStatus === "idle" && isDirty && (
              <span className="text-amber-500 text-xs">Unsaved changes</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Star */}
            <button
              title={isStarred ? "Remove from starred" : "Add to starred"}
              onClick={() => favoriteMutation.mutate({ documentId: id })}
              disabled={favoriteMutation.isPending}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isStarred ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Star className={cn("w-4 h-4", isStarred && "fill-current")} />
            </button>

            {/* Save Version */}
            <button
              onClick={() => saveVersionMutation.mutate({ documentId: id, content: doc.content as Record<string, unknown> ?? {} })}
              disabled={saveVersionMutation.isPending}
              title="Save version"
              className="hidden sm:flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Save Version</span>
            </button>

            {/* Export Markdown */}
            <button
              onClick={handleExportMarkdown}
              title="Export as Markdown"
              className="hidden sm:flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-2 py-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Comments */}
            <button
              onClick={() => togglePanel("comments")}
              className={cn(
                "flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors",
                rightPanel === "comments"
                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                  : "border-border hover:bg-muted"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Comments</span>
            </button>

            {/* Version history */}
            <button
              onClick={() => togglePanel("versions")}
              className={cn(
                "flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors",
                rightPanel === "versions"
                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                  : "border-border hover:bg-muted"
              )}
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">History</span>
            </button>

            {/* Info */}
            <button
              onClick={() => togglePanel("info")}
              className={cn(
                "flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors",
                rightPanel === "info"
                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                  : "border-border hover:bg-muted"
              )}
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">Info</span>
            </button>

            {/* Share */}
            <button
              onClick={() => setShowShareDialog(true)}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg px-3 py-1.5 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 pt-8 pb-20">
                {/* Cover image placeholder */}
                {(doc as { cover_url?: string | null }).cover_url && (
                  <div className="w-full h-40 rounded-2xl overflow-hidden mb-6 bg-muted">
                    <img
                      src={(doc as { cover_url: string }).cover_url}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Icon + Title */}
                <div className="flex items-start gap-3 mb-4">
                  {doc.icon && (
                    <span className="text-4xl leading-none mt-1 flex-shrink-0">{doc.icon}</span>
                  )}
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="flex-1 text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                  />
                </div>

                {/* Tiptap / Fallback editor */}
                {previewContent ? (
                  <div className="opacity-75 pointer-events-none">
                    <BlockEditor
                      documentId={id}
                      initialContent={previewContent}
                      readOnly={true}
                      onContentChange={() => {}}
                    />
                  </div>
                ) : (
                  <BlockEditor
                    documentId={id}
                    initialContent={initialContent}
                    readOnly={false}
                    onContentChange={handleContentChange}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right panels */}
          {rightPanel === "info" && (
            <div className="w-72 border-l border-border bg-card overflow-auto flex-shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">Document Info</span>
                <button onClick={() => setRightPanel(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4 text-sm">
                <div className="space-y-2">
                  {[
                    { label: "Created", value: formatDate(doc.created_at) },
                    { label: "Updated", value: timeAgo(doc.updated_at) },
                    { label: "Owner", value: (doc as { owner?: { name: string } }).owner?.name ?? "—" },
                    { label: "Version", value: `v${doc.version}` },
                    { label: "Words", value: String(doc.word_count ?? 0) },
                    { label: "Status", value: doc.status },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn(
                        "text-xs",
                        label === "Status" && doc.status === "PUBLISHED" ? "px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium" : ""
                      )}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Shared With</span>
                    <button onClick={() => setShowShareDialog(true)} className="text-xs text-brand-500 hover:underline">Manage</button>
                  </div>
                  {shares.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Not shared with anyone</p>
                  ) : (
                    <div className="space-y-2">
                      {shares.map((share) => (
                        <div key={share.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-medium text-brand-600 flex-shrink-0">
                            {share.user?.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="flex-1 text-xs truncate">{share.user?.name ?? "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{share.permission.toLowerCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {rightPanel === "versions" && (
            <VersionHistorySidebar
              documentId={id}
              onClose={() => setRightPanel(null)}
              onPreview={(content) => setPreviewContent(content)}
            />
          )}

          {rightPanel === "comments" && (
            <CommentsPanel
              documentId={id}
              onClose={() => setRightPanel(null)}
            />
          )}
        </div>
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold">Share Document</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{doc.title}</p>
              </div>
              <button onClick={() => setShowShareDialog(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {shares.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">People with access</p>
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-sm font-medium text-brand-600 flex-shrink-0">
                      {share.user?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{share.user?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">{share.user?.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {share.permission.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invite people</p>
              <input
                type="text"
                value={shareUserId}
                onChange={(e) => setShareUserId(e.target.value)}
                placeholder="User ID or email…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(PERMISSION_META) as Array<[SharePermission, typeof PERMISSION_META[SharePermission]]>).map(([perm, meta]) => (
                  <button
                    key={perm}
                    onClick={() => setSharePermission(perm)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                      sharePermission === perm
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowShareDialog(false)}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!shareUserId.trim()) { toast.error("Enter a user ID"); return; }
                  shareMutation.mutate({ documentId: id, userId: shareUserId.trim(), permission: sharePermission });
                }}
                disabled={!shareUserId.trim() || shareMutation.isPending}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {shareMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
