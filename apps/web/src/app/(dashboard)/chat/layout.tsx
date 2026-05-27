"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Hash,
  Lock,
  Plus,
  Search,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Grid3x3,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { CreateChannelDialog } from "@/components/chat/create-channel-dialog";
import { getInitials, generateAvatarColor } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-500 text-white text-xs font-semibold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const color = generateAvatarColor(name);
  const dim = size === "sm" ? "w-6 h-6 text-xs" : "w-5 h-5 text-[10px]";
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0", dim)}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Chat Layout ──────────────────────────────────────────────────────────────

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);

  const { data: channelList = [] } = api.chat.channels.list.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: unreadCounts = {} } = api.chat.unread.counts.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: orgMembers = [] } = api.chat.members.list.useQuery(
    { search: dmSearch },
    { enabled: showDMPicker }
  );

  const channels = channelList.filter(
    (c) => c.channel.type === "PUBLIC" || c.channel.type === "PRIVATE"
  );
  const dms = channelList.filter(
    (c) => c.channel.type === "DIRECT" || c.channel.type === "GROUP"
  );

  const filteredChannels = search
    ? channels.filter((c) =>
        c.channel.name?.toLowerCase().includes(search.toLowerCase())
      )
    : channels;

  const createDM = api.chat.channels.createDM.useMutation({
    onSuccess: (channel) => {
      setShowDMPicker(false);
      setDmSearch("");
      router.push(`/chat/${channel.id}`);
    },
  });

  return (
    <div className="flex h-full min-h-0 -m-6 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 flex flex-col bg-sidebar border-r border-border overflow-hidden">
        {/* Search */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/50">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a channel or person"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-1 scrollbar-hide">
          {/* ── Channels ── */}
          <div>
            <div className="flex items-center w-full px-3 py-1.5 group">
              <button
                type="button"
                onClick={() => setChannelsCollapsed((v) => !v)}
                className="flex-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {channelsCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span className="text-left">Channels</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-muted-foreground/20 transition-all"
                title="Create channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {!channelsCollapsed && (
              <ul className="mt-0.5 space-y-0.5 px-2">
                {filteredChannels.length === 0 && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground italic">
                    No channels yet
                  </li>
                )}
                {filteredChannels.map(({ channel, membership }) => {
                  const isActive = pathname === `/chat/${channel.id}`;
                  const unread = unreadCounts[channel.id] ?? 0;
                  return (
                    <li key={channel.id}>
                      <Link
                        href={`/chat/${channel.id}`}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all group",
                          isActive
                            ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
                            : unread > 0
                            ? "text-foreground font-semibold hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {channel.type === "PRIVATE" ? (
                          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                        ) : (
                          <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{channel.name}</span>
                        <UnreadBadge count={unread} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Direct Messages ── */}
          <div className="mt-2">
            <div className="flex items-center w-full px-3 py-1.5 group">
              <button
                type="button"
                onClick={() => setDmsCollapsed((v) => !v)}
                className="flex-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {dmsCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span className="text-left">Direct Messages</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDMPicker((v) => !v)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-muted-foreground/20 transition-all"
                title="New direct message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DM user picker */}
            {showDMPicker && (
              <div className="mx-2 mb-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={dmSearch}
                    onChange={(e) => setDmSearch(e.target.value)}
                    placeholder="Find a person…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <ul className="max-h-48 overflow-y-auto py-1">
                  {orgMembers.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">No users found</li>
                  )}
                  {orgMembers.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => createDM.mutate({ targetUserId: u.id })}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-sm transition-colors"
                      >
                        <UserAvatar name={u.name} />
                        <span className="truncate">{u.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!dmsCollapsed && (
              <ul className="mt-0.5 space-y-0.5 px-2">
                {dms.length === 0 && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground italic">
                    No direct messages
                  </li>
                )}
                {dms.map(({ channel, membership }) => {
                  const isActive = pathname === `/chat/${channel.id}`;
                  const unread = unreadCounts[channel.id] ?? 0;
                  const displayName = channel.name ?? "Direct Message";
                  return (
                    <li key={channel.id}>
                      <Link
                        href={`/chat/${channel.id}`}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all",
                          isActive
                            ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
                            : unread > 0
                            ? "text-foreground font-semibold hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <UserAvatar name={displayName} size="xs" />
                        {/* Online dot — static for MVP */}
                        <div className="relative flex-shrink-0 -ml-1 -mt-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 border-2 border-background" />
                        </div>
                        <span className="flex-1 truncate">{displayName}</span>
                        <UnreadBadge count={unread} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Browse channels */}
          <div className="px-2 mt-2">
            <Link
              href="/chat/browse"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
                pathname === "/chat/browse" && "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5 flex-shrink-0" />
              Browse channels
            </Link>
          </div>

          {/* Bookmarks */}
          <div className="px-2 mt-1">
            <Link
              href="/chat/bookmarks"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
                pathname === "/chat/bookmarks" && "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
              )}
            >
              <Bookmark className="w-3.5 h-3.5 flex-shrink-0" />
              Saved messages
            </Link>
          </div>

          {/* Search */}
          <div className="px-2 mt-1">
            <Link
              href="/chat/search"
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
                pathname === "/chat/search" && "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
              )}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              Search messages
            </Link>
          </div>
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Create channel dialog */}
      <CreateChannelDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
