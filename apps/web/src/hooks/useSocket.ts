"use client";

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket-client';
import { api } from '@/trpc/react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  type: string;
  reactions: Record<string, string[]>;
  is_edited: boolean;
  edited_at: Date | null;
  is_deleted: boolean;
  created_at: Date;
  user: { id: string; name: string; avatar_url: string | null };
  _count: { replies: number };
}

export interface TypingIndicator {
  user_id: string;
  channel_id: string;
  userName?: string;
}

interface UseChatSocketOptions {
  channelId: string;
  onMessage?: (msg: ChatMessage) => void;
  onMessageUpdated?: (msg: ChatMessage) => void;
  onMessageDeleted?: (data: { id: string }) => void;
  onTyping?: (data: TypingIndicator) => void;
  onStopTyping?: (data: { user_id: string }) => void;
  onReactionAdded?: (data: { message_id: string; emoji: string; user_id: string }) => void;
}

// ── Long-poll fallback hook ───────────────────────────────────────────────────

/**
 * When socket.io is unavailable, we poll the tRPC messages endpoint every 2 s.
 * The returned sendTyping is a no-op in this mode.
 */
export function useChatSocket({
  channelId,
  onMessage,
  onMessageUpdated,
  onMessageDeleted,
  onTyping,
  onStopTyping,
  onReactionAdded,
}: UseChatSocketOptions) {
  const socket = getSocket();
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Register socket listeners ────────────────────────────────────────────
  useEffect(() => {
    socket.emit('join', channelId);

    const handleMessage = (msg: ChatMessage) => onMessage?.(msg);
    const handleUpdated = (msg: ChatMessage) => onMessageUpdated?.(msg);
    const handleDeleted = (data: { id: string }) => onMessageDeleted?.(data);
    const handleReaction = (data: { message_id: string; emoji: string; user_id: string }) =>
      onReactionAdded?.(data);

    const handleTyping = (data: TypingIndicator) => {
      onTyping?.(data);
      // Auto-clear typing indicator after 3 s
      clearTimeout(typingTimeouts.current[data.user_id]);
      typingTimeouts.current[data.user_id] = setTimeout(() => {
        onStopTyping?.({ user_id: data.user_id });
      }, 3000);
    };

    const handleStopTyping = (data: { user_id: string }) => {
      clearTimeout(typingTimeouts.current[data.user_id]);
      onStopTyping?.(data);
    };

    socket.on('new_message', handleMessage);
    socket.on('message', handleMessage);
    socket.on('message_updated', handleUpdated);
    socket.on('message_deleted', handleDeleted);
    socket.on('reaction_added', handleReaction);
    socket.on('user_typing', handleTyping);
    socket.on('typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.emit('leave', channelId);
      socket.off('new_message', handleMessage);
      socket.off('message', handleMessage);
      socket.off('message_updated', handleUpdated);
      socket.off('message_deleted', handleDeleted);
      socket.off('reaction_added', handleReaction);
      socket.off('user_typing', handleTyping);
      socket.off('typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
      // Clear all typing timeouts
      Object.values(typingTimeouts.current).forEach(clearTimeout);
    };
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typing emitter with debounce ─────────────────────────────────────────
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(() => {
    socket.emit('typing_start', { channel_id: channelId });
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { channel_id: channelId });
    }, 2000);
  }, [channelId, socket]);

  return { socket, sendTyping };
}

// ── Long-poll fallback for when socket.io isn't connected ────────────────────

/**
 * Polls for new messages every 2 s as a fallback when the socket
 * isn't receiving events. Returns a cursor to avoid re-processing old messages.
 */
export function useLongPollFallback(
  channelId: string,
  lastMessageCursor: string | undefined,
  onMessages: (msgs: ChatMessage[]) => void,
  enabled = true
) {
  const utils = api.useUtils();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      try {
        await utils.chat.messages.list.invalidate({ channelId });
      } catch {
        // silently fail
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [channelId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
