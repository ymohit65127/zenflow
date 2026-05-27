"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

function NotificationItem({
  notif,
  onRead,
}: {
  notif: any;
  onRead: (id: string) => void;
}) {
  const actionUrl = (notif.data as any)?.action_url ?? null;

  return (
    <button
      onClick={() => {
        if (!notif.is_read) onRead(notif.id);
        if (actionUrl) window.location.href = actionUrl;
      }}
      className={cn(
        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
        !notif.is_read && "bg-brand-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        {!notif.is_read && (
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
        )}
        <div className={cn("flex-1 min-w-0", notif.is_read && "ml-4")}>
          <p className="text-sm font-medium leading-snug truncate">{notif.title}</p>
          {notif.body && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  const { data: unreadCount } = api.platform.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: notifications, isLoading } = api.platform.notifications.list.useQuery(
    { limit: 10 },
    { enabled: open }
  );

  const markReadMutation = api.platform.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.platform.notifications.unreadCount.invalidate();
      void utils.platform.notifications.list.invalidate();
    },
  });

  const markAllReadMutation = api.platform.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.platform.notifications.unreadCount.invalidate();
      void utils.platform.notifications.list.invalidate();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Notifications${(unreadCount ?? 0) > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell style={{ width: "1.125rem", height: "1.125rem" }} />
        {(unreadCount ?? 0) > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold px-1 leading-none">
            {unreadCount! > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {(unreadCount ?? 0) > 0 && (
                <span className="text-xs bg-brand-500/10 text-brand-600 rounded-full px-1.5 py-0.5 font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
            {(unreadCount ?? 0) > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((n: any) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onRead={(id) => markReadMutation.mutate({ ids: [id] })}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Inbox className="w-8 h-8" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 transition-colors"
            >
              View all notifications
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
