"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_LIST = [
  "👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉",
  "🔥", "👏", "🙏", "✅", "❌", "🚀", "💡", "📌",
  "⭐", "💯", "🤔", "😍", "🥳", "💪", "🤝", "👋",
  "🙌", "🤦", "🤷", "😅", "😎", "🥺", "😬", "🫡",
  "🎯", "💬", "📎", "🔗", "⚡", "🌟", "🏆", "🎊",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function EmojiPicker({ onSelect, className, triggerClassName }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          triggerClassName
        )}
        title="Add emoji"
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Picker */}
          <div
            className={cn(
              "absolute bottom-full mb-2 right-0 z-50",
              "bg-popover border border-border rounded-xl shadow-xl p-3",
              "w-[260px]"
            )}
          >
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Reactions</p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg rounded-md hover:bg-muted transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface InlineEmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

/** Inline emoji grid — no popover wrapper, for use in toolbars */
export function InlineEmojiGrid({ onSelect, className }: InlineEmojiPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-0.5 p-2", className)}>
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center text-lg rounded-md hover:bg-muted transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
