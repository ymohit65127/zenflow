"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Hash, Plus } from "lucide-react";
import { api } from "@/trpc/react";
import { CreateChannelDialog } from "@/components/chat/create-channel-dialog";

export default function ChatPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  const { data: channelList, isLoading } = api.chat.channels.list.useQuery();

  useEffect(() => {
    if (!isLoading && channelList && channelList.length > 0) {
      const first = channelList[0];
      if (first) {
        router.replace(`/chat/${first.channel.id}`);
      }
    }
  }, [channelList, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // No channels joined — show welcome screen
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-500/10 flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-brand-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Team Chat</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Collaborate in real-time with your team. Create channels for projects,
            topics, or just fun — or send direct messages to teammates.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push("/chat/browse")}
            className="flex items-center gap-2 justify-center px-5 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            <Hash className="w-4 h-4" />
            Browse channels
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 justify-center px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create channel
          </button>
        </div>

        {/* General CTA */}
        <div className="mt-4 p-4 rounded-xl border border-brand-500/30 bg-brand-500/5 text-sm text-left">
          <p className="font-medium text-brand-600 dark:text-brand-400 mb-1">
            💡 Get started with #general
          </p>
          <p className="text-muted-foreground text-xs">
            Join the #general channel to connect with everyone in your organisation.
          </p>
        </div>
      </div>

      <CreateChannelDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
