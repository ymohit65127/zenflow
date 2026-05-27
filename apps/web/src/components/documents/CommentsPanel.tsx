// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import {
  MessageSquare,
  Check,
  Trash2,
  X,
  Loader2,
  CornerDownRight,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface CommentsPanelProps {
  documentId: string;
  onClose?: () => void;
}

interface CommentAuthor {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: Date;
  is_resolved: boolean;
  selected_text: string | null;
  created_by: string;
  author: CommentAuthor;
  replies: Array<{
    id: string;
    content: string;
    created_at: Date;
    created_by: string;
    author: CommentAuthor;
  }>;
}

function Avatar({ user }: { user: CommentAuthor }) {
  return (
    <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-600">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.name ?? ""} className="w-full h-full rounded-full object-cover" />
      ) : (
        (user.name?.[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}

function CommentItem({
  comment,
  documentId,
  currentUserId,
}: {
  comment: Comment;
  documentId: string;
  currentUserId: string;
}) {
  const utils = api.useUtils();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const resolveMutation = api.documents.comments.resolve.useMutation({
    onSuccess: () => {
      void utils.documents.comments.list.invalidate({ documentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const unresolveMutation = api.documents.comments.unresolve.useMutation({
    onSuccess: () => {
      void utils.documents.comments.list.invalidate({ documentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.documents.comments.delete.useMutation({
    onSuccess: () => {
      void utils.documents.comments.list.invalidate({ documentId });
      toast.success("Comment deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const replyMutation = api.documents.comments.create.useMutation({
    onSuccess: () => {
      setReplyText("");
      setShowReply(false);
      void utils.documents.comments.list.invalidate({ documentId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        comment.is_resolved
          ? "border-border/50 bg-muted/30 opacity-60"
          : "border-border bg-card"
      )}
    >
      {/* Selected text quote */}
      {comment.selected_text && (
        <div className="text-xs text-muted-foreground border-l-2 border-brand-500/50 pl-2 mb-2 italic truncate">
          "{comment.selected_text}"
        </div>
      )}

      {/* Comment body */}
      <div className="flex items-start gap-2">
        <Avatar user={comment.author} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold truncate">{comment.author.name ?? "Unknown"}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm mt-0.5 leading-relaxed break-words">{comment.content}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-2 pl-9">
        <button
          onClick={() => setShowReply(!showReply)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <CornerDownRight className="w-3 h-3" />
          Reply
        </button>

        <button
          onClick={() => {
            if (comment.is_resolved) {
              unresolveMutation.mutate({ id: comment.id });
            } else {
              resolveMutation.mutate({ id: comment.id });
            }
          }}
          disabled={resolveMutation.isPending || unresolveMutation.isPending}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            comment.is_resolved
              ? "text-amber-600 hover:text-amber-700"
              : "text-green-600 hover:text-green-700"
          )}
        >
          {comment.is_resolved ? (
            <><Circle className="w-3 h-3" /> Unresolve</>
          ) : (
            <><Check className="w-3 h-3" /> Resolve</>
          )}
        </button>

        {comment.created_by === currentUserId && (
          <button
            onClick={() => deleteMutation.mutate({ id: comment.id })}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors ml-auto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2 pl-9 space-y-2 border-l border-border/50 ml-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <Avatar user={reply.author} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold">{reply.author.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-xs mt-0.5 leading-relaxed break-words">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="mt-2 pl-9 flex items-end gap-2">
          <textarea
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="flex-1 text-xs bg-muted border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                if (!replyText.trim()) return;
                replyMutation.mutate({
                  documentId,
                  parentCommentId: comment.id,
                  content: replyText.trim(),
                });
              }}
              disabled={!replyText.trim() || replyMutation.isPending}
              className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {replyMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Send
            </button>
            <button
              onClick={() => { setShowReply(false); setReplyText(""); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({ documentId, onClose }: CommentsPanelProps) {
  const utils = api.useUtils();
  const [newComment, setNewComment] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [currentUserId] = useState<string>("");

  const { data: comments = [], isLoading } = api.documents.comments.list.useQuery({
    documentId,
    showResolved,
  });

  const createMutation = api.documents.comments.create.useMutation({
    onSuccess: () => {
      setNewComment("");
      void utils.documents.comments.list.invalidate({ documentId });
      toast.success("Comment added");
    },
    onError: (e) => toast.error(e.message),
  });

  const unresolvedCount = (comments as unknown as Comment[]).filter((c) => !c.is_resolved).length;
  const resolvedCount = (comments as unknown as Comment[]).filter((c) => c.is_resolved).length;

  return (
    <div className="flex flex-col h-full w-80 border-l border-border bg-card flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Comments</span>
          {unresolvedCount > 0 && (
            <span className="bg-brand-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
              {unresolvedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={cn(
              "text-xs px-2 py-1 rounded-lg transition-colors",
              showResolved ? "bg-brand-500/10 text-brand-600" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* New comment input */}
      <div className="px-3 py-3 border-b border-border">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="w-full text-sm bg-muted border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (newComment.trim()) {
                createMutation.mutate({ documentId, content: newComment.trim() });
              }
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">⌘↵ to submit</span>
          <button
            onClick={() => {
              if (!newComment.trim()) return;
              createMutation.mutate({ documentId, content: newComment.trim() });
            }}
            disabled={!newComment.trim() || createMutation.isPending}
            className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Post
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (comments as unknown as Comment[]).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs text-muted-foreground">
              {showResolved ? "No resolved comments" : "Start a conversation above"}
            </p>
          </div>
        ) : (
          (comments as unknown as Comment[]).map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              documentId={documentId}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}
