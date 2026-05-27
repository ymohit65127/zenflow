"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Database,
  Table2,
  PenSquare,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DocumentType =
  | "DOCUMENT"
  | "FOLDER"
  | "DATABASE"
  | "SPREADSHEET"
  | "WHITEBOARD"
  | "TEMPLATE";

interface DocNode {
  id: string;
  title: string;
  type: DocumentType;
  icon: string | null;
  updated_at: Date;
  _count?: { children: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function docIcon(type: DocumentType, icon: string | null, expanded = false) {
  if (icon) return <span className="text-base leading-none">{icon}</span>;
  switch (type) {
    case "FOLDER":
      return expanded ? (
        <FolderOpen className="w-4 h-4 text-amber-500" />
      ) : (
        <Folder className="w-4 h-4 text-amber-500" />
      );
    case "DATABASE":
      return <Database className="w-4 h-4 text-brand-500" />;
    case "SPREADSHEET":
      return <Table2 className="w-4 h-4 text-green-500" />;
    case "WHITEBOARD":
      return <PenSquare className="w-4 h-4 text-violet-500" />;
    case "TEMPLATE":
      return <LayoutTemplate className="w-4 h-4 text-pink-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────

function ContextMenu({
  doc,
  onRename,
  onDelete,
  onNewChild,
  onClose,
}: {
  doc: DocNode;
  onRename: () => void;
  onDelete: () => void;
  onNewChild: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-30 py-1 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {doc.type === "FOLDER" && (
        <button
          onClick={() => { onNewChild(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
        >
          <Plus className="w-3.5 h-3.5" />
          New document here
        </button>
      )}
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
      >
        <Pencil className="w-3.5 h-3.5" />
        Rename
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left text-red-500"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single tree node
// ─────────────────────────────────────────────────────────────────────────────

function TreeNode({
  doc,
  depth = 0,
}: {
  doc: DocNode;
  depth?: number;
}) {
  const pathname = usePathname();
  const utils = api.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [isDragOver, setIsDragOver] = useState(false);

  const isActive = pathname === `/documents/${doc.id}`;
  const hasChildren =
    doc.type === "FOLDER" && (doc._count?.children ?? 0) > 0;

  const { data: children = [], isFetching: loadingChildren } =
    api.documents.getChildren.useQuery(
      { parentId: doc.id },
      { enabled: expanded && doc.type === "FOLDER" }
    );

  const updateMutation = api.documents.update.useMutation({
    onSuccess: () => {
      void utils.documents.list.invalidate();
      void utils.documents.getChildren.invalidate({ parentId: doc.id });
      setRenaming(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Moved to trash");
      void utils.documents.list.invalidate();
      void utils.documents.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = api.documents.create.useMutation({
    onSuccess: (newDoc) => {
      void utils.documents.getChildren.invalidate({ parentId: doc.id });
      setExpanded(true);
      window.location.href = `/documents/${newDoc.id}`;
    },
    onError: (e) => toast.error(e.message),
  });

  function handleRename() {
    if (renameValue.trim() && renameValue !== doc.title) {
      updateMutation.mutate({ id: doc.id, title: renameValue.trim() });
    } else {
      setRenaming(false);
    }
  }

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-all select-none",
          isActive
            ? "bg-brand-500/10 text-brand-600"
            : "hover:bg-muted text-muted-foreground hover:text-foreground",
          isDragOver && "bg-brand-500/5 border border-dashed border-brand-500/30"
        )}
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
        onClick={() => {
          if (doc.type === "FOLDER") {
            setExpanded(!expanded);
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={() => setIsDragOver(false)}
      >
        {/* Expand arrow */}
        <span className="w-4 flex-shrink-0">
          {doc.type === "FOLDER" ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : null}
        </span>

        {/* Icon */}
        <span className="flex-shrink-0">
          {docIcon(doc.type, doc.icon, expanded)}
        </span>

        {/* Title */}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent border-b border-brand-500 outline-none text-sm text-foreground"
          />
        ) : (
          <Link
            href={doc.type !== "FOLDER" ? `/documents/${doc.id}` : "#"}
            onClick={(e) => { if (doc.type === "FOLDER") e.preventDefault(); }}
            className="flex-1 min-w-0 text-sm truncate"
          >
            {doc.title}
          </Link>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.type === "FOLDER" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                createMutation.mutate({
                  title: "Untitled",
                  type: "DOCUMENT",
                  parent_id: doc.id,
                });
              }}
              className="hover:text-foreground p-0.5 rounded transition-colors"
              title="New document"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="hover:text-foreground p-0.5 rounded transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <ContextMenu
                  doc={doc}
                  onRename={() => setRenaming(true)}
                  onDelete={() => deleteMutation.mutate({ id: doc.id })}
                  onNewChild={() => {
                    createMutation.mutate({
                      title: "Untitled",
                      type: "DOCUMENT",
                      parent_id: doc.id,
                    });
                    setExpanded(true);
                  }}
                  onClose={() => setShowMenu(false)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && doc.type === "FOLDER" && (
        <div>
          {loadingChildren ? (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground" style={{ paddingLeft: `${1 + depth * 1}rem` }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : children.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1.5" style={{ paddingLeft: `${1.5 + depth * 1}rem` }}>
              Empty folder
            </p>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.id}
                doc={{
                  id: child.id,
                  title: child.title,
                  type: child.type as DocumentType,
                  icon: child.icon,
                  updated_at: child.updated_at,
                  _count: { children: 0 },
                }}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Doc tree root
// ─────────────────────────────────────────────────────────────────────────────

export function DocTree() {
  const utils = api.useUtils();
  const { data: docs = [], isLoading } = api.documents.list.useQuery({});

  const createMutation = api.documents.create.useMutation({
    onSuccess: (doc) => {
      void utils.documents.list.invalidate();
      void utils.documents.stats.invalidate();
      if (doc.type !== "FOLDER") {
        window.location.href = `/documents/${doc.id}`;
      }
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tree header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Documents
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => createMutation.mutate({ title: "Untitled", type: "DOCUMENT" })}
            title="New document"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => createMutation.mutate({ title: "New Folder", type: "FOLDER" })}
            title="New folder"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <Folder className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree body */}
      <div className="flex-1 overflow-auto py-1.5 px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">No documents yet</p>
            <button
              onClick={() => createMutation.mutate({ title: "Getting Started", type: "DOCUMENT" })}
              className="mt-2 text-xs text-brand-500 hover:underline"
            >
              Create first document
            </button>
          </div>
        ) : (
          docs.map((doc) => {
            const docCount = (doc as { _count?: { children: number } })._count;
            return (
              <TreeNode
                key={doc.id}
                doc={{
                  id: doc.id,
                  title: doc.title,
                  type: doc.type as DocumentType,
                  icon: doc.icon,
                  updated_at: doc.updated_at,
                  ...(docCount !== undefined ? { _count: docCount } : {}),
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
