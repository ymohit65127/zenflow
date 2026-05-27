"use client";

import { useState, useRef, useEffect } from 'react';
import {
  CornerDownRight,
  Pencil,
  Trash2,
  MessageSquare,
  Pin,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { getInitials, generateAvatarColor } from '@/lib/utils';
import { EmojiPicker } from './emoji-picker';
import { UserStatusBadge } from './UserStatusBadge';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageUser = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export type MessageData = {
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
  is_pinned?: boolean;
  created_at: Date;
  user: MessageUser;
  _count: { replies: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = generateAvatarColor(name);
  const dim =
    size === 'lg' ? 'w-10 h-10 text-sm' : size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white flex-shrink-0',
        dim
      )}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

export function formatMessageTime(date: Date) {
  return format(date, 'h:mm a');
}

export function formatFullTime(date: Date) {
  return format(date, 'MMM d, yyyy h:mm a');
}

/** Render simple markdown: **bold**, *italic*, `code`, [links](url) */
export function RenderContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((https?:\/\/[^\)]+)\))/g;
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
    } else if (match[5] && match[6]) {
      parts.push(
        <a
          key={key++}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 hover:underline"
        >
          {match[5]}
        </a>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push(<span key={key++}>{content.slice(last)}</span>);
  }
  return <span>{parts}</span>;
}

// ── Reaction Bar ──────────────────────────────────────────────────────────────

function ReactionBar({
  reactions,
  currentUserId,
  onReact,
}: {
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
            title={`${users.length} reaction${users.length !== 1 ? 's' : ''}`}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border transition-all',
              hasReacted
                ? 'border-brand-500/50 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-border bg-muted/50 hover:border-brand-500/30 hover:bg-muted text-foreground'
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

// ── Main Component ────────────────────────────────────────────────────────────

interface MessageItemProps {
  message: MessageData;
  isGrouped: boolean;
  currentUserId: string;
  userStatus?: { status: string; status_text?: string | null; status_emoji?: string | null } | null;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: MessageData) => void;
  onEdit: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
  onPin?: (messageId: string) => void;
}

export function MessageItem({
  message,
  isGrouped,
  currentUserId,
  userStatus,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
}: MessageItemProps) {
  const utils = api.useUtils();
  const [hovering, setHovering] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isOwn = message.user_id === currentUserId;
  const reactions = (message.reactions as Record<string, string[]>) ?? {};

  // Bookmark state
  const { data: bookmarkData } = api.chat.bookmarks.check.useQuery(
    { message_id: message.id },
    { enabled: hovering }
  );
  const bookmarkMutation = api.chat.bookmarks.save.useMutation({
    onSuccess: () => void utils.chat.bookmarks.check.invalidate({ message_id: message.id }),
    onError: (err) => toast.error(err.message),
  });
  const unbookmarkMutation = api.chat.bookmarks.remove.useMutation({
    onSuccess: () => void utils.chat.bookmarks.check.invalidate({ message_id: message.id }),
    onError: (err) => toast.error(err.message),
  });

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

  if (message.type === 'SYSTEM') {
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
      className={cn('relative flex gap-3 px-4 py-0.5', isGrouped ? 'mt-0' : 'mt-4')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Avatar / spacer */}
      <div className="w-8 flex-shrink-0 mt-0.5 relative">
        {!isGrouped ? (
          <div className="relative">
            <UserAvatar name={message.user.name} />
            {userStatus && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <UserStatusBadge
                  status={userStatus as any}
                  size="xs"
                  showTooltip={false}
                />
              </div>
            )}
          </div>
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
        {/* Header */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{message.user.name}</span>
              {userStatus?.status_emoji && (
                <span className="text-xs" title={userStatus.status_text ?? undefined}>
                  {userStatus.status_emoji}
                </span>
              )}
            </div>
            <span
              className="text-xs text-muted-foreground"
              title={formatFullTime(new Date(message.created_at))}
            >
              {formatMessageTime(new Date(message.created_at))}
            </span>
            {message.is_pinned && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
          </div>
        )}

        {/* Body */}
        {message.is_deleted ? (
          <p className="text-sm text-muted-foreground italic">This message was deleted</p>
        ) : editing ? (
          <div>
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                }
                if (e.key === 'Escape') {
                  setEditing(false);
                  setEditContent(message.content);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-brand-500 bg-muted/30 text-sm outline-none resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">
                  Enter
                </kbd>{' '}
                save ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">
                  Esc
                </kbd>{' '}
                cancel
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
          <ReactionBar
            reactions={reactions}
            currentUserId={currentUserId}
            onReact={(emoji) => onReact(message.id, emoji)}
          />
        )}

        {/* Thread reply count */}
        {!message.is_deleted && message._count.replies > 0 && (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-brand-500 hover:text-brand-600 hover:underline transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {message._count.replies} {message._count.replies === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Hover action bar */}
      {hovering && !message.is_deleted && !editing && (
        <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-md px-1 py-0.5 z-10">
          {/* React */}
          <EmojiPicker
            onSelect={(emoji) => onReact(message.id, emoji)}
            triggerClassName="w-7 h-7"
          />
          {/* Reply in thread */}
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Reply in thread"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
          </button>
          {/* Pin */}
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(message.id)}
              title={message.is_pinned ? 'Pinned' : 'Pin message'}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                message.is_pinned
                  ? 'text-amber-500 hover:bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Bookmark */}
          <button
            type="button"
            onClick={() => {
              if (bookmarkData?.bookmarked) {
                unbookmarkMutation.mutate({ message_id: message.id });
              } else {
                bookmarkMutation.mutate({ message_id: message.id });
              }
            }}
            title={bookmarkData?.bookmarked ? 'Remove bookmark' : 'Bookmark message'}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              bookmarkData?.bookmarked
                ? 'text-brand-500 hover:bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {bookmarkData?.bookmarked ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Own message actions */}
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
