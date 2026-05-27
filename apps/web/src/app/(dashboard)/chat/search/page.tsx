"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Hash, Lock, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { getInitials, generateAvatarColor } from "@/lib/utils";
import { RenderContent } from "@/components/chat/MessageItem";

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

// ── Search Result ─────────────────────────────────────────────────────────────

function SearchResult({
  result,
  onNavigate,
}: {
  result: {
    id: string;
    content: string;
    is_deleted: boolean;
    created_at: Date;
    user: { id: string; name: string; avatar_url: string | null };
    channel: { id: string; name: string; type: string };
  };
  onNavigate: (channelId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(result.channel.id)}
      className="w-full text-left flex gap-3 p-4 rounded-xl border border-border bg-card hover:border-brand-500/30 hover:bg-brand-500/5 transition-all"
    >
      <UserAvatar name={result.user.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{result.user.name}</span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {result.channel.type === "PRIVATE" ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Hash className="w-3 h-3" />
            )}
            <span>{result.channel.name ?? "DM"}</span>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {format(new Date(result.created_at), "MMM d, yyyy")}
          </span>
        </div>
        {result.is_deleted ? (
          <p className="text-sm text-muted-foreground italic">This message was deleted</p>
        ) : (
          <p className="text-sm text-muted-foreground line-clamp-2 text-left">
            <RenderContent content={result.content} />
          </p>
        )}
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChannelId = searchParams.get("channelId") ?? undefined;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | undefined>(initialChannelId);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isFetching } = api.chat.search.global.useQuery(
    { query: debouncedQuery, limit: 30, channel_id: channelFilter },
    { enabled: debouncedQuery.length >= 2 }
  );

  const { data: channelList = [] } = api.chat.channels.list.useQuery(undefined);

  const results = data?.results ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
        <Search className="w-4 h-4 text-brand-500" />
        <h1 className="font-semibold text-sm">Search Messages</h1>
      </div>

      {/* Search bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex gap-3 max-w-2xl">
          {/* Query input */}
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/40 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {(isLoading || isFetching) && debouncedQuery.length >= 2 && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
            )}
          </div>

          {/* Channel filter */}
          <select
            value={channelFilter ?? ""}
            onChange={(e) => setChannelFilter(e.target.value || undefined)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-brand-500 transition-colors"
          >
            <option value="">All channels</option>
            {channelList.map(({ channel }) => (
              <option key={channel.id} value={channel.id}>
                {channel.type === "PRIVATE" ? "🔒 " : "#"}{channel.name ?? "DM"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Empty state: no query */}
        {debouncedQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-brand-500" />
            </div>
            <h3 className="font-semibold mb-1">Search across all channels</h3>
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to start searching
            </p>
          </div>
        )}

        {/* No results */}
        {debouncedQuery.length >= 2 && !isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-sm">No messages found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try different keywords or remove filters
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs text-muted-foreground mb-3">
              {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
              <strong>"{debouncedQuery}"</strong>
              {channelFilter && " in selected channel"}
            </p>
            {results.map((result) => (
              <SearchResult
                key={result.id}
                result={result as any}
                onNavigate={(channelId) => router.push(`/chat/${channelId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
