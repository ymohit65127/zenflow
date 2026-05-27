"use client";

import { useState } from "react";
import { X, Hash, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateChannelDialog({ open, onClose }: CreateChannelDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  const createChannel = api.chat.channels.create.useMutation({
    onSuccess: (channel) => {
      toast.success(`#${channel.name} created`);
      void utils.chat.channels.list.invalidate();
      onClose();
      router.push(`/chat/${channel.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleNameChange = (value: string) => {
    // Auto-lowercase, spaces to hyphens
    setName(
      value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createChannel.mutate({ name: name.trim(), description: description.trim() || undefined, type });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Dialog */}
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Create a channel</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("PUBLIC")}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all",
                  type === "PUBLIC"
                    ? "border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-400"
                    : "border-border hover:border-brand-500/50"
                )}
              >
                <Hash className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Public</p>
                  <p className="text-xs text-muted-foreground">Anyone can join</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType("PRIVATE")}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all",
                  type === "PRIVATE"
                    ? "border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-400"
                    : "border-border hover:border-brand-500/50"
                )}
              >
                <Lock className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Private</p>
                  <p className="text-xs text-muted-foreground">Invite only</p>
                </div>
              </button>
            </div>

            {/* Channel name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Channel name <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. marketing-team"
                  maxLength={80}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this channel about?"
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm outline-none placeholder:text-muted-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createChannel.isPending}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createChannel.isPending ? "Creating…" : "Create channel"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
