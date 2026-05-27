"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  Lock,
  X,
  Search,
  Settings,
  Users,
  Send,
  Bold,
  Italic,
  Code,
  Link2,
  Paperclip,
  CornerDownRight,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { getInitials, generateAvatarColor } from "@/lib/utils";
import { EmojiPicker } from "@/components/chat/emoji-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageUser = { id: string; name: string; avatar_url: string | null };
type MessageItem = {
  id: string;
  channel_id: string;
  user_id: string;
  thread_id: string | null;
  content: string;
  type: string;
  reactions: unknown;
  is_edited: boolean;
  edited_at: Date | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
  user: MessageUser;
  _count: { replies: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const color = generateAvatarColor(name);
  const dim =
    size === "lg"
      ? "w-10 h-10 text-sm"
      : size === "md"
      ? "w-8 h-8 text-xs"
      : "w-6 h-6 text-[10px]";
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", dim)}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

function formatMessageTime(date: Date) {
  return format(date, "h:mm a");
}

function formatFullTime(date: Date) {
  return format(date, "MMM d, yyyy h:mm a");
}

function getDividerLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/** Render simple markdown: **bold**, *italic*, `code` */
function RenderContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  // Process inline markdown
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{content.slice(last, match.index)}</span>);
    }
    if (match[2]) {
      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push(<span key={key++}>{content.slice(last)}</span>);
  }
  return <span>{parts}</span>;
}

// ─── Message Reactions ────────────────────────────────────────────────────────

function MessageReactions({
  messageId,
  reactions,
  currentUserId,
  onReact,
}: {
  messageId: string;
  reactions: Record<string, string[]>;
  currentUserId: string;
  onReact: (emoji: string) => void;
}) {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {entries.map(([emoji, users]) => {
        const hasReacted = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            title={users.map((id) => id).join(", ")}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border transition-all",
              hasReacted
                ? "border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                : "border-border bg-muted/50 hover:border-brand-500/30 hover:bg-muted text-foreground"
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Single Message ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isGrouped,
  currentUserId,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  message: MessageItem;
  isGrouped: boolean;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: MessageItem) => void;
  onEdit: (message: MessageItem) => void;
  onDelete: (messageId: string) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isOwn = message.user_id === currentUserId;
  const reactions = (message.reactions as Record<string, string[]>) ?? {};

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editing]);

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit({ ...message, content: editContent });
    }
    setEditing(false);
  };

  if (message.type === "SYSTEM") {
    return (
      <div className="flex items-center justify-center gap-3 my-1 px-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{message.content}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return (
    <div
      className={cn("relative flex gap-3 px-4 py-0.5", isGrouped ? "mt-0" : "mt-4")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Avatar / spacer */}
      <div className="w-8 flex-shrink-0 mt-0.5">
        {!isGrouped ? (
          <UserAvatar name={message.user.name} />
        ) : (
          hovering && (
            <span className="text-[10px] text-muted-foreground leading-none mt-1.5 block text-right pr-0.5">
              {formatMessageTime(new Date(message.created_at))}
            </span>
          )
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header — only for first in group */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm">{message.user.name}</span>
            <span className="text-xs text-muted-foreground" title={formatFullTime(new Date(message.created_at))}>
              {formatMessageTime(new Date(message.created_at))}
            </span>
          </div>
        )}

        {/* Message body */}
        {message.is_deleted ? (
          <p className="text-sm text-muted-foreground italic">This message was deleted</p>
        ) : editing ? (
          <div>
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditContent(message.content);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-brand-500 bg-muted/30 text-sm outline-none resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> save ·{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Esc</kbd> cancel
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed break-words">
            <RenderContent content={message.content} />
            {message.is_edited && (
              <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
            )}
          </p>
        )}

        {/* Reactions */}
        {!message.is_deleted && (
          <MessageReactions
            messageId={message.id}
            reactions={reactions}
            currentUserId={currentUserId}
            onReact={(emoji) => onReact(message.id, emoji)}
          />
        )}

        {/* Thread preview */}
        {!message.is_deleted && message._count.replies > 0 && (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-brand-500 hover:text-brand-600 hover:underline transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {message._count.replies} {message._count.replies === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Hover action bar */}
      {hovering && !message.is_deleted && !editing && (
        <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-md px-1 py-0.5 z-10">
          <EmojiPicker
            onSelect={(emoji) => onReact(message.id, emoji)}
            triggerClassName="w-7 h-7"
          />
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Reply in thread"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Edit"
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                title="Delete"
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Thread Panel ─────────────────────────────────────────────────────────────

function ThreadPanel({
  parentMessageId,
  channelName,
  currentUserId,
  onClose,
}: {
  parentMessageId: string;
  channelName: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [replyContent, setReplyContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread } = api.chat.messages.getThread.useQuery(
    { parentMessageId },
    { refetchInterval: 3000 }
  );

  const replyMutation = api.chat.messages.reply.useMutation({
    onSuccess: () => {
      setReplyContent("");
      void utils.chat.messages.getThread.invalidate({ parentMessageId });
    },
    onError: (err) => toast.error(err.message),
  });

  const reactMutation = api.chat.messages.react.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const editMutation = api.chat.messages.edit.useMutation({
    onSuccess: () => void utils.chat.messages.getThread.invalidate({ parentMessageId }),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.chat.messages.delete.useMutation({
    onSuccess: () => void utils.chat.messages.getThread.invalidate({ parentMessageId }),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.replies]);

  if (!thread) return null;

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!replyContent.trim()) return;
    replyMutation.mutate({ parentMessageId, content: replyContent });
  };

  return (
    <div className="w-80 flex-shrink-0 border-l border-border flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="font-semibold text-sm">Thread</h3>
          <p className="text-xs text-muted-foreground">#{channelName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {/* Parent message */}
        <div className="px-4 pb-3 mb-3 border-b border-border">
          <MessageBubble
            message={thread.parent as unknown as MessageItem}
            isGrouped={false}
            currentUserId={currentUserId}
            onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
            onReply={() => undefined}
            onEdit={(msg) => editMutation.mutate({ messageId: msg.id, content: msg.content })}
            onDelete={(id) => deleteMutation.mutate({ messageId: id })}
          />
        </div>

        {thread.replies.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground text-center">
            No replies yet. Be the first!
          </p>
        )}

        {thread.replies.map((reply, idx) => {
          const prev = idx > 0 ? thread.replies[idx - 1] : null;
          const isGrouped =
            !!prev &&
            prev.user_id === reply.user_id &&
            new Date(reply.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

          return (
            <MessageBubble
              key={reply.id}
              message={reply as unknown as MessageItem}
              isGrouped={isGrouped}
              currentUserId={currentUserId}
              onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
              onReply={() => undefined}
              onEdit={(msg) => editMutation.mutate({ messageId: msg.id, content: msg.content })}
              onDelete={(id) => deleteMutation.mutate({ messageId: id })}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="flex-shrink-0 px-3 pb-3">
        <form
          onSubmit={handleSend}
          className="border border-border rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all"
        >
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Reply in thread…"
            rows={2}
            className="w-full px-3 pt-2.5 pb-1 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <button
              type="submit"
              disabled={!replyContent.trim() || replyMutation.isPending}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500 text-white disabled:opacity-40 hover:bg-brand-600 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Message Input ────────────────────────────────────────────────────────────

function MessageInput({
  channelName,
  onSend,
  isPending,
}: {
  channelName: string;
  onSend: (content: string) => void;
  isPending: boolean;
}) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent =
      content.slice(0, start) + prefix + (selected || "text") + suffix + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      const newPos = start + prefix.length + (selected || "text").length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!content.trim() || isPending) return;
    onSend(content.trim());
    setContent("");
  };

  // Auto-expand textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [content]);

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2">
      <div className="border border-border rounded-2xl overflow-hidden focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all bg-card">
        {/* Format toolbar */}
        <div className="flex items-center gap-0.5 px-3 pt-2.5 pb-1 border-b border-border/50">
          <button
            type="button"
            onClick={() => insertFormat("**", "**")}
            title="Bold"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat("*", "*")}
            title="Italic"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat("`", "`")}
            title="Code"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat("[", "](url)")}
            title="Link"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          className="w-full px-4 py-3 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground min-h-[44px] max-h-[200px] leading-relaxed"
          rows={1}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-0.5">
            <EmojiPicker
              onSelect={(emoji) => setContent((prev) => prev + emoji)}
              triggerClassName="w-7 h-7"
            />
            <button
              type="button"
              title="Attach file"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              Shift+Enter for newline
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() || isPending}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-brand-500 text-white text-xs font-medium disabled:opacity-40 hover:bg-brand-600 transition-colors"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Channel Page ─────────────────────────────────────────────────────────────

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  // Optimistic messages list
  const [optimisticMessages, setOptimisticMessages] = useState<MessageItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Session user — from channel member list check
  const { data: channelData } = api.chat.channels.get.useQuery(
    { channelId },
    { retry: false }
  );

  const { data: messagesData, isLoading: messagesLoading } =
    api.chat.messages.list.useQuery(
      { channelId, limit: 50 },
      { refetchInterval: 3000 }
    );

  // Merge server messages with optimistic ones
  const serverMessages: MessageItem[] = (messagesData?.messages ?? []) as unknown as MessageItem[];

  // Dedupe: remove optimistic messages that exist in server data
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const pendingOptimistic = optimisticMessages.filter((m) => !serverIds.has(m.id));
  const allMessages = [...serverMessages, ...pendingOptimistic];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // Mark channel as read when opened
  const markRead = api.chat.unread.markRead.useMutation();
  useEffect(() => {
    markRead.mutate({ channelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const sendMessage = api.chat.messages.send.useMutation({
    onMutate: ({ content }) => {
      // We need a session user — use channelData members to find current user
      // For optimistic UI we create a placeholder
      const tempId = `optimistic-${Date.now()}`;
      // We'll get current user from channel members — find the one who is "me"
      // Since we can't easily get session here, use a placeholder and clear on success
      const placeholder: MessageItem = {
        id: tempId,
        channel_id: channelId,
        user_id: "me",
        thread_id: null,
        content,
        type: "TEXT",
        reactions: {},
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date(),
        user: { id: "me", name: "You", avatar_url: null },
        _count: { replies: 0 },
      };
      setOptimisticMessages((prev) => [...prev, placeholder]);
    },
    onSuccess: () => {
      setOptimisticMessages([]);
      void utils.chat.messages.list.invalidate({ channelId });
      void utils.chat.channels.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
      setOptimisticMessages([]);
    },
  });

  const reactMutation = api.chat.messages.react.useMutation({
    onSuccess: () => void utils.chat.messages.list.invalidate({ channelId }),
    onError: (err) => toast.error(err.message),
  });

  const editMutation = api.chat.messages.edit.useMutation({
    onSuccess: () => void utils.chat.messages.list.invalidate({ channelId }),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.chat.messages.delete.useMutation({
    onSuccess: () => void utils.chat.messages.list.invalidate({ channelId }),
    onError: (err) => toast.error(err.message),
  });

  // Group messages by date and consecutive author
  const groupedMessages = (() => {
    const result: { date: Date; messages: { msg: MessageItem; isGrouped: boolean }[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: { msg: MessageItem; isGrouped: boolean }[] = [];

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i]!;
      const prev = allMessages[i - 1];
      const msgDate = new Date(msg.created_at);

      if (!currentDate || !isSameDay(currentDate, msgDate)) {
        if (currentGroup.length > 0) {
          result.push({ date: currentDate!, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [];
      }

      const isGrouped =
        msg.type !== "SYSTEM" &&
        !!prev &&
        prev.type !== "SYSTEM" &&
        prev.user_id === msg.user_id &&
        msgDate.getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

      currentGroup.push({ msg, isGrouped });
    }

    if (currentGroup.length > 0 && currentDate) {
      result.push({ date: currentDate, messages: currentGroup });
    }

    return result;
  })();

  const channel = channelData;

  // Determine current user id from the members list (first own membership)
  // We'll look for the user who is "me" via a rough heuristic —
  // we use a separate members query to get the current user context
  const { data: orgMembers = [] } = api.chat.members.list.useQuery({});
  // currentUserId is not directly available, but we can identify it from messages
  // sent (they all come through protectedProcedure which enforces userId)
  // For simplicity, we'll use a ref to track after first send
  // Actually, let's read it from members + a hook trick:
  // We create a dedicated tiny procedure call to resolve it —
  // Use orgMembers to exclude known others. Actually the cleanest approach:
  // The channel members list includes our own membership.
  const currentUserId =
    channel?.members.find((m) => !orgMembers.some((u) => u.id === m.user_id))?.user_id ?? "";

  const channelName =
    channel?.name ??
    (channel?.type === "DIRECT"
      ? channel.members.find((m) => m.user_id !== currentUserId)?.user?.name ?? "Direct Message"
      : "channel");

  const threadMessage = threadMessageId
    ? allMessages.find((m) => m.id === threadMessageId)
    : null;

  if (!channel && !messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-muted-foreground text-sm mb-3">Channel not found</p>
          <button
            onClick={() => router.push("/chat")}
            className="text-brand-500 text-sm hover:underline"
          >
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ── Main chat area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {channel?.type === "PRIVATE" ? (
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : channel?.type === "DIRECT" ? (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: generateAvatarColor(channelName) }}
              >
                {getInitials(channelName)}
              </div>
            ) : (
              <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <h2 className="font-semibold text-sm truncate">{channelName}</h2>
            {channel?.description && (
              <>
                <span className="text-border">|</span>
                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {channel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
                <Users className="w-3.5 h-3.5" />
                <span>{channel.members.length}</span>
              </div>
            )}
            <button
              title="Search messages"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              title="Channel settings"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto py-2"
        >
          {messagesLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!messagesLoading && allMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
                <Hash className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-semibold mb-1">
                Welcome to #{channelName}
              </h3>
              <p className="text-sm text-muted-foreground">
                This is the beginning of the #{channelName} channel. Send a message to get started!
              </p>
            </div>
          )}

          {groupedMessages.map(({ date, messages }) => (
            <div key={date.toISOString()}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-3 px-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-full border border-border bg-background">
                  {getDividerLabel(date)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {/* Messages */}
              {messages.map(({ msg, isGrouped }) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isGrouped={isGrouped}
                  currentUserId={currentUserId}
                  onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
                  onReply={(m) => setThreadMessageId(m.id)}
                  onEdit={(m) => editMutation.mutate({ messageId: m.id, content: m.content })}
                  onDelete={(id) => deleteMutation.mutate({ messageId: id })}
                />
              ))}
            </div>
          ))}

          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Message input */}
        <MessageInput
          channelName={channelName}
          onSend={(content) => sendMessage.mutate({ channelId, content })}
          isPending={sendMessage.isPending}
        />
      </div>

      {/* ── Thread Panel ──────────────────────────────────────────────── */}
      {threadMessageId && (
        <ThreadPanel
          parentMessageId={threadMessageId}
          channelName={channelName}
          currentUserId={currentUserId}
          onClose={() => setThreadMessageId(null)}
        />
      )}
    </div>
  );
}
