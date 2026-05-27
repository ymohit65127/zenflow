"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { DocTree } from "@/components/documents/doc-tree";
import {
  ArrowLeft,
  Share2,
  Clock,
  History,
  X,
  Loader2,
  ChevronRight,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Info,
  Users,
  Eye,
  MessageSquare,
  Pencil,
  Shield,
  Check,
  GitBranch,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SharePermission = "VIEW" | "COMMENT" | "EDIT" | "MANAGE";

const PERMISSION_META: Record<
  SharePermission,
  { label: string; icon: React.ReactNode }
> = {
  VIEW: { label: "Can view", icon: <Eye className="w-3.5 h-3.5" /> },
  COMMENT: {
    label: "Can comment",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  EDIT: { label: "Can edit", icon: <Pencil className="w-3.5 h-3.5" /> },
  MANAGE: { label: "Manager", icon: <Shield className="w-3.5 h-3.5" /> },
};

// ─────────────────────────────────────────────────────────────────────────────
// Editor toolbar
// ─────────────────────────────────────────────────────────────────────────────

function Toolbar({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement | null> }) {
  function insertAt(prefix: string, suffix = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end);
    const replacement = prefix + selected + suffix;
    el.setRangeText(replacement, start, end, "select");
    el.focus();
    // Trigger React's onChange
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertLine(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
    el.setRangeText(prefix, lineStart, lineStart, "end");
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const tools = [
    { icon: <Bold className="w-3.5 h-3.5" />, title: "Bold", onClick: () => insertAt("**", "**") },
    { icon: <Italic className="w-3.5 h-3.5" />, title: "Italic", onClick: () => insertAt("_", "_") },
    { icon: null, divider: true },
    { icon: <Heading1 className="w-3.5 h-3.5" />, title: "Heading 1", onClick: () => insertLine("# ") },
    { icon: <Heading2 className="w-3.5 h-3.5" />, title: "Heading 2", onClick: () => insertLine("## ") },
    { icon: <Heading3 className="w-3.5 h-3.5" />, title: "Heading 3", onClick: () => insertLine("### ") },
    { icon: null, divider: true },
    { icon: <List className="w-3.5 h-3.5" />, title: "Bullet list", onClick: () => insertLine("- ") },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, title: "Numbered list", onClick: () => insertLine("1. ") },
  ];

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-card/50">
      {tools.map((tool, i) =>
        tool.divider ? (
          <div key={i} className="w-px h-4 bg-border mx-1" />
        ) : (
          <button
            key={i}
            title={tool.title}
            onMouseDown={(e) => {
              e.preventDefault();
              tool.onClick?.();
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {tool.icon}
          </button>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const utils = api.useUtils();

  const { data: doc, isLoading } = api.documents.get.useQuery({ id });
  const { data: shares = [] } = api.documents.getShares.useQuery({ documentId: id });
  const { data: versions = [] } = api.documents.versions.list.useQuery({ documentId: id });

  // ── Local state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [shareUserId, setShareUserId] = useState("");
  const [sharePermission, setSharePermission] =
    useState<SharePermission>("VIEW");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      const rawContent = doc.content as Record<string, unknown> | null;
      setContent((rawContent?.content as string) ?? "");
    }
  }, [doc]);

  // ── Auto-save every 5 seconds ──────────────────────────────────────────────
  const updateMutation = api.documents.update.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setIsDirty(false);
      void utils.documents.get.invalidate({ id });
      void utils.documents.recent.invalidate();
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => {
      setSaveStatus("idle");
    },
  });

  const saveDoc = useCallback(() => {
    if (!isDirty) return;
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    setSaveStatus("saving");
    updateMutation.mutate({
      id,
      title: title.trim() || "Untitled",
      content: { type: "doc", content },
      word_count: wordCount,
    });
  }, [id, title, content, isDirty, updateMutation]);

  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDoc, 5000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, saveDoc]);

  function handleContentChange(val: string) {
    setContent(val);
    setIsDirty(true);
    setSaveStatus("idle");
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    setIsDirty(true);
    setSaveStatus("idle");
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
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
        <Link
          href="/documents"
          className="text-brand-500 text-sm hover:underline mt-2 inline-block"
        >
          Back to documents
        </Link>
      </div>
    );
  }

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
          <Link
            href="/documents"
            className="text-muted-foreground hover:text-foreground transition-colors xl:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
            <Link href="/documents" className="hover:text-foreground transition-colors hidden sm:block">
              Documents
            </Link>
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
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Saving…</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === "idle" && isDirty && (
              <span className="text-amber-500 text-xs">Unsaved changes</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                saveVersionMutation.mutate({
                  documentId: id,
                  content: { type: "doc", content },
                });
              }}
              disabled={saveVersionMutation.isPending}
              className="hidden sm:flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Save Version
            </button>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center gap-1.5 text-sm border border-border hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">Info</span>
            </button>

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
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <Toolbar textareaRef={textareaRef} />

            {/* Content area */}
            <div className="flex-1 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 pt-8 pb-20">
                {/* Title */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled"
                  className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-6"
                />

                {/* Content textarea */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Start writing here… Supports Markdown formatting."
                  className="w-full bg-transparent border-none outline-none resize-none text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 min-h-[60vh]"
                  onInput={(e) => {
                    // Auto-resize
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          {showSidebar && (
            <div className="w-72 border-l border-border bg-card overflow-auto flex-shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">Document Info</span>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 text-sm">
                {/* Meta */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-xs">{formatDate(doc.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="text-xs">{timeAgo(doc.updated_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="text-xs">{(doc as { owner?: { name: string } }).owner?.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="text-xs">v{doc.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Words</span>
                    <span className="text-xs">{doc.word_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-medium",
                        doc.status === "PUBLISHED"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Shared With
                    </span>
                    <button
                      onClick={() => setShowShareDialog(true)}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      Manage
                    </button>
                  </div>
                  {shares.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Not shared with anyone
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {shares.map((share) => (
                        <div key={share.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-medium text-brand-600 flex-shrink-0">
                            {share.user?.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="flex-1 text-xs truncate">
                            {share.user?.name ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {share.permission.toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Version history */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      Versions
                    </span>
                    <button
                      onClick={() => {
                        saveVersionMutation.mutate({
                          documentId: id,
                          content: { type: "doc", content },
                        });
                      }}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      Save now
                    </button>
                  </div>
                  {versions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No saved versions
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {versions.slice(0, 8).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <GitBranch className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">
                            v{v.version}
                          </span>
                          <span className="text-muted-foreground/60 flex-1 truncate">
                            {timeAgo(v.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.title}
                </p>
              </div>
              <button
                onClick={() => setShowShareDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current shares */}
            {shares.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  People with access
                </p>
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-sm font-medium text-brand-600 flex-shrink-0">
                      {share.user?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {share.user?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {share.user?.email}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {share.permission.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add share */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Invite people
              </p>
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
                  if (!shareUserId.trim()) {
                    toast.error("Enter a user ID");
                    return;
                  }
                  shareMutation.mutate({
                    documentId: id,
                    userId: shareUserId.trim(),
                    permission: sharePermission,
                  });
                }}
                disabled={!shareUserId.trim() || shareMutation.isPending}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {shareMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
