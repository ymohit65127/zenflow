"use client";

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { MessageItem, type MessageData } from './MessageItem';

interface ThreadPanelProps {
  parentMessageId: string;
  channelName: string;
  currentUserId: string;
  onClose: () => void;
}

export function ThreadPanel({
  parentMessageId,
  channelName,
  currentUserId,
  onClose,
}: ThreadPanelProps) {
  const utils = api.useUtils();
  const [replyContent, setReplyContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading } = api.chat.threads.get.useQuery(
    { parent_id: parentMessageId },
    { refetchInterval: 3000 }
  );

  const replyMutation = api.chat.threads.reply.useMutation({
    onSuccess: () => {
      setReplyContent('');
      void utils.chat.threads.get.invalidate({ parent_id: parentMessageId });
      void utils.chat.messages.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reactMutation = api.chat.messages.react.useMutation({
    onSuccess: () => void utils.chat.threads.get.invalidate({ parent_id: parentMessageId }),
    onError: (err) => toast.error(err.message),
  });

  const editMutation = api.chat.messages.edit.useMutation({
    onSuccess: () => void utils.chat.threads.get.invalidate({ parent_id: parentMessageId }),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.chat.messages.delete.useMutation({
    onSuccess: () => void utils.chat.threads.get.invalidate({ parent_id: parentMessageId }),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.replies.length]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!replyContent.trim() || replyMutation.isPending) return;
    replyMutation.mutate({ parent_id: parentMessageId, content: replyContent.trim() });
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {thread && (
          <>
            {/* Parent message */}
            <div className="px-0 pb-3 mb-3 border-b border-border">
              <MessageItem
                message={thread.parent as unknown as MessageData}
                isGrouped={false}
                currentUserId={currentUserId}
                onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
                onReply={() => undefined}
                onEdit={(msg) =>
                  editMutation.mutate({ messageId: msg.id, content: msg.content })
                }
                onDelete={(id) => deleteMutation.mutate({ messageId: id })}
              />
            </div>

            {/* Replies */}
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
                new Date(reply.created_at).getTime() -
                  new Date(prev.created_at).getTime() <
                  5 * 60 * 1000;

              return (
                <MessageItem
                  key={reply.id}
                  message={reply as unknown as MessageData}
                  isGrouped={isGrouped}
                  currentUserId={currentUserId}
                  onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
                  onReply={() => undefined}
                  onEdit={(msg) =>
                    editMutation.mutate({ messageId: msg.id, content: msg.content })
                  }
                  onDelete={(id) => deleteMutation.mutate({ messageId: id })}
                />
              );
            })}

            <div ref={bottomRef} />
          </>
        )}
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
              if (e.key === 'Enter' && !e.shiftKey) {
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
              {replyMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
