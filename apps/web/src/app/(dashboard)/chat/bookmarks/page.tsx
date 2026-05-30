"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Hash, Lock, MessageSquare, Loader2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { getInitials, generateAvatarColor } from "@/lib/utils";
import { RenderContent } from "@/components/chat/MessageItem";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookmarkEntry = {
  id: string;
  note: string | null;
  created_at: Date;
  message: {
    id: string;
    content: string;
    is_deleted: boolean;
    created_at: Date;
    user: { id: string; name: string; avatar_url: string | null };
    channel: { id: string; name: string; type: string };
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const color = generateAvatarColor(name);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

function ChannelIcon({ type }: { type: string }) {
  if (type === "PRIVATE") return <Lock className="w-3 h-3" />;
  return <Hash className="w-3 h-3" />;
}

// ── Bookmark Card ─────────────────────────────────────────────────────────────

function BookmarkCard({
  bookmark,
  onRemove,
  onNavigate,
}: {
  bookmark: BookmarkEntry;
  onRemove: (messageId: string) => void;
  onNavigate: (channelId: string) => void;
}) {
  return (
    <div className="group relative flex gap-3 p-4 rounded-xl border border-border bg-card hover:border-brand-500/30 hover:bg-card/80 transition-all">
      {/* Avatar */}
      <UserAvatar name={bookmark.message.user.name} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{bookmark.message.user.name}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(bookmark.message.created_at), "MMM d, yyyy h:mm a")}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(bookmark.message.channel.id)}
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand-500 transition-colors"
          >
            <ChannelIcon type={bookmark.message.channel.type} />
            <span>{bookmark.message.channel.name ?? "DM"}</span>
          </button>
        </div>

        {/* Message content */}
        {bookmark.message.is_deleted ? (
          <p className="text-sm text-muted-foreground italic">This message was deleted</p>
        ) : (
          <p className="text-sm leading-relaxed break-words line-clamp-3">
            <RenderContent content={bookmark.message.content} />
          </p>
        )}

        {/* Note */}
        {bookmark.note && (
          <div className="mt-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
            {bookmark.note}
          </div>
        )}

        {/* Bookmarked at */}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Saved {format(new Date(bookmark.created_at), "MMM d")}
        </p>
      </div>

      {/* Remove button (visible on hover) */}
      <button
        type="button"
        onClick={() => onRemove(bookmark.message.id)}
        title="Remove bookmark"
        className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <Bookmark className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allBookmarks, setAllBookmarks] = useState<BookmarkEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading, isFetching } = api.chat.bookmarks.list.useQuery(
    { limit: 20, cursor }
  );

  useEffect(() => {
    if (!data) return;
    const items = data.bookmarks as unknown as BookmarkEntry[];
    if (!initialized) {
      setAllBookmarks(items);
      setInitialized(true);
    } else {
      setAllBookmarks((prev) => [...prev, ...items]);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeMutation = api.chat.bookmarks.remove.useMutation({
    onSuccess: (_, variables) => {
      setAllBookmarks((prev) =>
        prev.filter((b) => b.message.id !== variables.message_id)
      );
      toast.success("Bookmark removed");
      void utils.chat.bookmarks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const displayBookmarks = initialized ? allBookmarks : (data?.bookmarks as unknown as BookmarkEntry[] ?? []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
        <Bookmark className="w-4 h-4 text-brand-500" />
        <h1 className="font-semibold text-sm">Saved Messages</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          {displayBookmarks.length} bookmark{displayBookmarks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && displayBookmarks.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && displayBookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
              <Bookmark className="w-7 h-7 text-brand-500" />
            </div>
            <h3 className="font-semibold mb-1">No saved messages</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Hover over a message and click the bookmark icon to save it here.
            </p>
          </div>
        )}

        <div className="space-y-3 max-w-2xl">
          {displayBookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onRemove={(messageId) => removeMutation.mutate({ message_id: messageId })}
              onNavigate={(channelId) => router.push(`/chat/${channelId}`)}
            />
          ))}
        </div>

        {/* Load more */}
        {data?.hasMore && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isFetching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
