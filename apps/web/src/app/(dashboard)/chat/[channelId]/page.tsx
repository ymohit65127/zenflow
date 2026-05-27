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
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { getInitials, generateAvatarColor } from "@/lib/utils";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { MessageItem, type MessageData } from "@/components/chat/MessageItem";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { useChatSocket, useLongPollFallback } from "@/hooks/useSocket";

// ── Types ─────────────────────────────────────────────────────────────────────

type TypingUser = { user_id: string; name?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white flex-shrink-0",
        dim
      )}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

function getDividerLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers
    .slice(0, 3)
    .map((u) => u.name ?? "Someone")
    .join(", ");
  const text =
    typingUsers.length === 1
      ? `${names} is typing…`
      : typingUsers.length <= 3
      ? `${names} are typing…`
      : "Several people are typing…";

  return (
    <div className="px-4 py-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex gap-0.5 items-end h-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {text}
    </div>
  );
}

// ── Load More Button ──────────────────────────────────────────────────────────

function LoadMoreButton({
  onClick,
  isLoading,
}: {
  onClick: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex justify-center py-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
        )}
        Load earlier messages
      </button>
    </div>
  );
}

// ── Message Input ─────────────────────────────────────────────────────────────

function MessageInput({
  channelName,
  onSend,
  onTyping,
  isPending,
}: {
  channelName: string;
  onSend: (content: string) => void;
  onTyping: () => void;
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
          {[
            { icon: Bold, action: () => insertFormat("**", "**"), title: "Bold" },
            { icon: Italic, action: () => insertFormat("*", "*"), title: "Italic" },
            { icon: Code, action: () => insertFormat("`", "`"), title: "Code" },
            { icon: Link2, action: () => insertFormat("[", "](url)"), title: "Link" },
          ].map(({ icon: Icon, action, title }) => (
            <button
              key={title}
              type="button"
              onClick={action}
              title={title}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onTyping();
          }}
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

// ── Channel Page ──────────────────────────────────────────────────────────────

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const router = useRouter();
  const utils = api.useUtils();

  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageData[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [extraMessages, setExtraMessages] = useState<MessageData[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: channelData } = api.chat.channels.get.useQuery(
    { channelId },
    { retry: false }
  );

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isFetching,
  } = api.chat.messages.list.useQuery(
    { channelId, limit: 50 },
    { refetchInterval: 5000 }
  );

  // Cursor-based pagination (load more)
  const [oldestCursor, setOldestCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMoreQuery = api.chat.messagesV2.list.useQuery(
    { channelId, cursor: oldestCursor, limit: 50, direction: "before" },
    { enabled: false }
  );

  const handleLoadMore = useCallback(async () => {
    const oldest = serverMessages[0];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const result = await utils.chat.messagesV2.list.fetch({
        channelId,
        cursor: oldest.created_at.toISOString(),
        limit: 50,
        direction: "before",
      });
      if (result.messages.length > 0) {
        setExtraMessages((prev) => [...(result.messages as unknown as MessageData[]), ...prev]);
      }
    } catch (err: any) {
      toast.error("Failed to load more messages");
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, utils]);

  // ── Socket real-time ──────────────────────────────────────────────────────

  const { sendTyping } = useChatSocket({
    channelId,
    onMessage: (msg) => {
      void utils.chat.messages.list.invalidate({ channelId });
    },
    onMessageUpdated: () => {
      void utils.chat.messages.list.invalidate({ channelId });
    },
    onMessageDeleted: () => {
      void utils.chat.messages.list.invalidate({ channelId });
    },
    onTyping: (data) => {
      setTypingUsers((prev) => {
        if (data.user_id === currentUserId) return prev;
        if (prev.find((u) => u.user_id === data.user_id)) return prev;
        return [...prev, { user_id: data.user_id }];
      });
    },
    onStopTyping: (data) => {
      setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
    },
    onReactionAdded: () => {
      void utils.chat.messages.list.invalidate({ channelId });
    },
  });

  // Long-poll fallback
  useLongPollFallback(channelId, undefined, () => {}, true);

  // ── Merge messages ────────────────────────────────────────────────────────

  const serverMessages: MessageData[] = (messagesData?.messages ?? []) as unknown as MessageData[];
  const serverIds = new Set(serverMessages.map((m) => m.id));
  const pendingOptimistic = optimisticMessages.filter((m) => !serverIds.has(m.id));
  const allMessages = [...extraMessages, ...serverMessages, ...pendingOptimistic];

  // Scroll to bottom on new messages (not on load-more)
  const prevLengthRef = useRef(0);
  useEffect(() => {
    const newLen = serverMessages.length + pendingOptimistic.length;
    if (newLen > prevLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = newLen;
  }, [serverMessages.length, pendingOptimistic.length]);

  // Mark as read
  const markRead = api.chat.unread.markRead.useMutation();
  useEffect(() => {
    markRead.mutate({ channelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const sendMessage = api.chat.messages.send.useMutation({
    onMutate: ({ content }) => {
      const tempId = `optimistic-${Date.now()}`;
      const placeholder: MessageData = {
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
        is_pinned: false,
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

  const pinMutation = api.chat.messagesV2.pin.useMutation({
    onSuccess: () => void utils.chat.messages.list.invalidate({ channelId }),
    onError: (err) => toast.error(err.message),
  });

  // ── Group messages ────────────────────────────────────────────────────────

  const groupedMessages = (() => {
    const result: { date: Date; messages: { msg: MessageData; isGrouped: boolean }[] }[] = [];
    let currentDate: Date | null = null;
    let currentGroup: { msg: MessageData; isGrouped: boolean }[] = [];

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

  // ── Current user detection ────────────────────────────────────────────────

  const { data: orgMembers = [] } = api.chat.members.list.useQuery({});
  const currentUserId =
    channelData?.members.find(
      (m) => !orgMembers.some((u) => u.id === m.user_id)
    )?.user_id ?? "";

  const channel = channelData;
  const channelName =
    channel?.name ??
    (channel?.type === "DIRECT"
      ? channel.members.find((m) => m.user_id !== currentUserId)?.user?.name ?? "Direct Message"
      : "channel");

  // ── Render ────────────────────────────────────────────────────────────────

  if (!channel && !messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-muted-foreground text-sm mb-3">Channel not found</p>
          <button onClick={() => router.push("/chat")} className="text-brand-500 text-sm hover:underline">
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  const hasMoreHistory = extraMessages.length > 0
    ? false // simplified: disable after one load-more
    : (messagesData?.messages?.length ?? 0) === 50;

  return (
    <div className="flex h-full min-h-0">
      {/* Main chat area */}
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
              onClick={() => router.push(`/chat/search?channelId=${channelId}`)}
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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto py-2">
          {messagesLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Load more (scroll up) */}
          {!messagesLoading && hasMoreHistory && (
            <LoadMoreButton onClick={handleLoadMore} isLoading={loadingMore} />
          )}

          {!messagesLoading && allMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
                <Hash className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-semibold mb-1">Welcome to #{channelName}</h3>
              <p className="text-sm text-muted-foreground">
                This is the beginning of the #{channelName} channel.
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
              {messages.map(({ msg, isGrouped }) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isGrouped={isGrouped}
                  currentUserId={currentUserId}
                  onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
                  onReply={(m) => setThreadMessageId(m.id)}
                  onEdit={(m) => editMutation.mutate({ messageId: m.id, content: m.content })}
                  onDelete={(id) => deleteMutation.mutate({ messageId: id })}
                  onPin={(id) => pinMutation.mutate({ messageId: id })}
                />
              ))}
            </div>
          ))}

          {/* Typing indicators */}
          <TypingIndicator typingUsers={typingUsers} />

          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Message input */}
        <MessageInput
          channelName={channelName}
          onSend={(content) => sendMessage.mutate({ channelId, content })}
          onTyping={sendTyping}
          isPending={sendMessage.isPending}
        />
      </div>

      {/* Thread panel */}
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
