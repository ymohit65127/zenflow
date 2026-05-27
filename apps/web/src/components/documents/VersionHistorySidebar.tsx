"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { GitBranch, RotateCcw, Eye, X, Loader2, Clock } from "lucide-react";

interface VersionHistorySidebarProps {
  documentId: string;
  onClose?: () => void;
  onPreview?: (content: Record<string, unknown>) => void;
}

export function VersionHistorySidebar({ documentId, onClose, onPreview }: VersionHistorySidebarProps) {
  const utils = api.useUtils();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data: versions = [], isLoading } = api.documents.versions.list.useQuery({
    documentId,
  });

  const getVersion = api.documents.versions.get.useQuery(
    { versionId: previewId! },
    { enabled: !!previewId }
  );

  const restoreMutation = api.documents.versions.restore.useMutation({
    onSuccess: () => {
      toast.success("Version restored successfully");
      setRestoring(null);
      void utils.documents.get.invalidate({ id: documentId });
      void utils.documents.versions.list.invalidate({ documentId });
    },
    onError: (e) => {
      toast.error(e.message);
      setRestoring(null);
    },
  });

  function handlePreview(versionId: string) {
    setPreviewId(versionId);
  }

  function handleRestore(versionId: string) {
    if (!window.confirm("Restore this version? The current content will be saved as a new version.")) return;
    setRestoring(versionId);
    restoreMutation.mutate({ documentId, versionId });
  }

  // Notify parent when preview content is loaded
  if (previewId && getVersion.data && onPreview) {
    onPreview(getVersion.data.content as Record<string, unknown>);
  }

  return (
    <div className="flex flex-col h-full w-72 border-l border-border bg-card flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Version History</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preview banner */}
      {previewId && (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <span className="text-xs text-amber-600 font-medium">Previewing old version</span>
          <button
            onClick={() => { setPreviewId(null); }}
            className="text-xs text-amber-600 hover:underline"
          >
            Exit preview
          </button>
        </div>
      )}

      {/* Versions list */}
      <div className="flex-1 overflow-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <GitBranch className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium">No saved versions</p>
            <p className="text-xs text-muted-foreground mt-1">
              Versions are saved automatically when you edit the document.
            </p>
          </div>
        ) : (
          <div className="px-2 space-y-0.5">
            {versions.map((version, idx) => (
              <div
                key={version.id}
                className={cn(
                  "group relative rounded-xl p-3 transition-colors cursor-pointer",
                  previewId === version.id
                    ? "bg-brand-500/10 border border-brand-500/20"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {versions.length - idx}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium truncate">
                        Version {version.version}
                      </span>
                      {idx === 0 && (
                        <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(version.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePreview(version.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                  {idx > 0 && (
                    <button
                      onClick={() => handleRestore(version.id)}
                      disabled={restoring === version.id}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {restoring === version.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
