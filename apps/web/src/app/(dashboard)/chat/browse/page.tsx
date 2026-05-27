"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Search, Users, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export default function BrowseChannelsPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: channels = [], isLoading } = api.chat.channels.getAll.useQuery({ search });

  const joinChannel = api.chat.channels.join.useMutation({
    onMutate: ({ channelId }) => setJoiningId(channelId),
    onSuccess: (_, { channelId }) => {
      toast.success("Joined channel");
      void utils.chat.channels.list.invalidate();
      void utils.chat.channels.getAll.invalidate();
      setJoiningId(null);
      router.push(`/chat/${channelId}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setJoiningId(null);
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border">
        <h1 className="text-xl font-semibold mb-1">Browse channels</h1>
        <p className="text-sm text-muted-foreground">
          {channels.length} public channel{channels.length !== 1 ? "s" : ""} in your organisation
        </p>
        {/* Search */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 max-w-sm transition-all">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Hash className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No channels match your search" : "No public channels yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/50 hover:shadow-sm transition-all group"
              >
                {/* Channel icon / name */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-5 h-5 text-brand-500" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (channel.is_member) {
                        router.push(`/chat/${channel.id}`);
                      } else {
                        joinChannel.mutate({ channelId: channel.id });
                      }
                    }}
                    disabled={joiningId === channel.id}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0",
                      channel.is_member
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                    )}
                  >
                    {joiningId === channel.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : channel.is_member ? (
                      <>
                        <Check className="w-3 h-3" />
                        Joined
                      </>
                    ) : (
                      "Join"
                    )}
                  </button>
                </div>

                <h3 className="font-semibold text-sm mb-1">#{channel.name}</h3>

                {channel.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {channel.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic mb-3">No description</p>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {channel.member_count} member{channel.member_count !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
