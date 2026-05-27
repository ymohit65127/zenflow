// @ts-nocheck
"use client";
// @ts-nocheck

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BlockEditorProps {
  documentId: string;
  initialContent: Record<string, unknown> | null;
  readOnly?: boolean;
  onContentChange?: (content: Record<string, unknown>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiptap editor (primary implementation)
// ─────────────────────────────────────────────────────────────────────────────

let TiptapEditor: React.ComponentType<BlockEditorProps> | null = null;

try {
  // Dynamically bind Tiptap — will throw at module level if not installed
  const { useEditor, EditorContent } = require("@tiptap/react") as typeof import("@tiptap/react");
  const StarterKit = require("@tiptap/starter-kit").default as typeof import("@tiptap/starter-kit").default;
  const Placeholder = require("@tiptap/extension-placeholder").default as typeof import("@tiptap/extension-placeholder").default;
  const TaskList = require("@tiptap/extension-task-list").default as typeof import("@tiptap/extension-task-list").default;
  const TaskItem = require("@tiptap/extension-task-item").default as typeof import("@tiptap/extension-task-item").default;
  const TextAlign = require("@tiptap/extension-text-align").default as typeof import("@tiptap/extension-text-align").default;
  const Underline = require("@tiptap/extension-underline").default as typeof import("@tiptap/extension-underline").default;
  const Link = require("@tiptap/extension-link").default as typeof import("@tiptap/extension-link").default;

  // ── Floating toolbar ──────────────────────────────────────────────────────

  function FloatingToolbar({ editor }: { editor: import("@tiptap/react").Editor }) {
    const [show, setShow] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const updateVisibility = () => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        if (from === to) {
          setShow(false);
          return;
        }
        const view = editor.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const editorEl = view.dom.parentElement;
        if (!editorEl) return;
        const rect = editorEl.getBoundingClientRect();
        setPosition({
          top: start.top - rect.top - 44,
          left: (start.left + end.left) / 2 - rect.left - 100,
        });
        setShow(true);
      };

      editor.on("selectionUpdate", updateVisibility);
      editor.on("blur", () => setShow(false));
      return () => {
        editor.off("selectionUpdate", updateVisibility);
        editor.off("blur");
      };
    }, [editor]);

    if (!show) return null;

    return (
      <div
        ref={toolbarRef}
        className="absolute z-50 flex items-center gap-0.5 bg-card border border-border rounded-xl shadow-xl px-1.5 py-1"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {[
          { label: "B", title: "Bold", active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
          { label: "I", title: "Italic", active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
          { label: "U", title: "Underline", active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
          { label: "S", title: "Strike", active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
        ].map((btn) => (
          <button
            key={btn.label}
            title={btn.title}
            onClick={btn.action}
            className={cn(
              "w-7 h-7 rounded-lg text-xs font-bold transition-colors",
              btn.active ? "bg-brand-500/20 text-brand-600" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {btn.label}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-0.5" />
        <button
          title="Link"
          onClick={() => {
            const url = window.prompt("URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={cn(
            "w-7 h-7 rounded-lg text-xs font-medium transition-colors",
            editor.isActive("link") ? "bg-brand-500/20 text-brand-600" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          🔗
        </button>
      </div>
    );
  }

  // ── Slash command menu ────────────────────────────────────────────────────

  const SLASH_COMMANDS = [
    { label: "Heading 1", hint: "h1", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", hint: "h2", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", hint: "h3", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Bullet List", hint: "ul", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleBulletList().run() },
    { label: "Ordered List", hint: "ol", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleOrderedList().run() },
    { label: "Task List", hint: "todo", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleTaskList().run() },
    { label: "Code Block", hint: "code", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleCodeBlock().run() },
    { label: "Blockquote", hint: "quote", action: (e: import("@tiptap/react").Editor) => e.chain().focus().toggleBlockquote().run() },
    { label: "Divider", hint: "hr", action: (e: import("@tiptap/react").Editor) => e.chain().focus().setHorizontalRule().run() },
  ] as const;

  function SlashMenu({ editor, onClose }: { editor: import("@tiptap/react").Editor; onClose: () => void }) {
    const [idx, setIdx] = useState(0);
    const [filter, setFilter] = useState("");

    const filtered = SLASH_COMMANDS.filter(
      (c) =>
        !filter ||
        c.label.toLowerCase().includes(filter.toLowerCase()) ||
        c.hint.toLowerCase().includes(filter.toLowerCase())
    );

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (i + 1) % filtered.length); }
        if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (i - 1 + filtered.length) % filtered.length); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (filtered[idx]) { filtered[idx].action(editor); onClose(); }
        }
        if (e.key === "Escape") onClose();
        if (e.key.length === 1) setFilter((f) => f + e.key);
        if (e.key === "Backspace") setFilter((f) => f.slice(0, -1));
      };
      window.addEventListener("keydown", handler, true);
      return () => window.removeEventListener("keydown", handler, true);
    }, [editor, filtered, idx, onClose]);

    return (
      <div className="absolute z-50 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
        ) : (
          filtered.map((cmd, i) => (
            <button
              key={cmd.hint}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                i === idx ? "bg-brand-500/10 text-brand-600" : "hover:bg-muted text-foreground"
              )}
              onClick={() => { cmd.action(editor); onClose(); }}
            >
              <span className="text-xs text-muted-foreground w-8 flex-shrink-0 font-mono">{cmd.hint}</span>
              {cmd.label}
            </button>
          ))
        )}
      </div>
    );
  }

  // ── Block toolbar ─────────────────────────────────────────────────────────

  function BlockToolbar({ editor }: { editor: import("@tiptap/react").Editor }) {
    const groups = [
      {
        items: [
          { label: "H1", title: "Heading 1", active: editor.isActive("heading", { level: 1 }), action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
          { label: "H2", title: "Heading 2", active: editor.isActive("heading", { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
          { label: "H3", title: "Heading 3", active: editor.isActive("heading", { level: 3 }), action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        ],
      },
      {
        items: [
          { label: "B", title: "Bold", active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
          { label: "I", title: "Italic", active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
          { label: "U", title: "Underline", active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
          { label: "S̶", title: "Strike", active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
        ],
      },
      {
        items: [
          { label: "• List", title: "Bullet list", active: editor.isActive("bulletList"), action: () => editor.chain().focus().toggleBulletList().run() },
          { label: "1. List", title: "Ordered list", active: editor.isActive("orderedList"), action: () => editor.chain().focus().toggleOrderedList().run() },
          { label: "☑ Task", title: "Task list", active: editor.isActive("taskList"), action: () => editor.chain().focus().toggleTaskList().run() },
        ],
      },
      {
        items: [
          { label: "❝", title: "Blockquote", active: editor.isActive("blockquote"), action: () => editor.chain().focus().toggleBlockquote().run() },
          { label: "</>", title: "Code block", active: editor.isActive("codeBlock"), action: () => editor.chain().focus().toggleCodeBlock().run() },
          { label: "—", title: "Divider", active: false, action: () => editor.chain().focus().setHorizontalRule().run() },
        ],
      },
    ];

    return (
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border bg-card/80 flex-wrap">
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <div className="w-px h-4 bg-border mx-1" />}
            {group.items.map((item) => (
              <button
                key={item.label}
                title={item.title}
                onMouseDown={(e) => { e.preventDefault(); item.action(); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                  item.active
                    ? "bg-brand-500/15 text-brand-600"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── Main Tiptap editor component ─────────────────────────────────────────

  TiptapEditor = function TiptapEditorImpl({ documentId, initialContent, readOnly, onContentChange }: BlockEditorProps) {
    const updateMutation = api.documents.update.useMutation();
    const [showSlash, setShowSlash] = useState(false);
    const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ history: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Underline,
        Link.configure({ openOnClick: true, HTMLAttributes: { target: "_blank", rel: "noopener" } }),
        Placeholder.configure({ placeholder: "Type '/' for commands…" }),
      ],
      content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
      editable: !readOnly,
      onUpdate: ({ editor: ed }) => {
        const json = ed.getJSON() as Record<string, unknown>;
        onContentChange?.(json);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          updateMutation.mutate({ id: documentId, content: json });
        }, 1000);
      },
      editorProps: {
        handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
          if (event.key === "/" && !showSlash) {
            setTimeout(() => {
              setSlashPos({ top: 24, left: 0 }); // approximate
              setShowSlash(true);
            }, 0);
          }
          return false;
        },
      },
    });

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    if (!editor) return null;

    return (
      <div className="flex flex-col flex-1 overflow-hidden relative" ref={containerRef}>
        {!readOnly && <BlockToolbar editor={editor} />}
        <div className="relative flex-1 overflow-auto">
          {!readOnly && showSlash && (
            <div style={{ position: "absolute", ...slashPos }}>
              <SlashMenu editor={editor} onClose={() => { setShowSlash(false); editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).run(); }} />
            </div>
          )}
          <FloatingToolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none min-h-[60vh] p-0 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/40 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
          />
        </div>
      </div>
    );
  };
} catch {
  // Tiptap not installed — TiptapEditor stays null, fallback will be used
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: plain textarea editor
// ─────────────────────────────────────────────────────────────────────────────

function FallbackEditor({ documentId, initialContent, readOnly, onContentChange }: BlockEditorProps) {
  const updateMutation = api.documents.update.useMutation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rawText = typeof initialContent?.content === "string"
    ? (initialContent.content as string)
    : "";
  const [value, setValue] = useState(rawText);

  function handleChange(val: string) {
    setValue(val);
    const json: Record<string, unknown> = { type: "doc", content: val };
    onContentChange?.(json);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id: documentId, content: json });
    }, 1000);
  }

  const toolbarButtons = [
    { label: "B", wrap: ["**", "**"], title: "Bold" },
    { label: "I", wrap: ["_", "_"], title: "Italic" },
    { label: "~~S~~", wrap: ["~~", "~~"], title: "Strike" },
    { label: "`Code`", wrap: ["`", "`"], title: "Inline code" },
  ];

  function wrapSelection(prefix: string, suffix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end);
    const newVal = el.value.substring(0, start) + prefix + selected + suffix + el.value.substring(end);
    handleChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border bg-card/80">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.label}
              title={btn.title}
              onMouseDown={(e) => { e.preventDefault(); wrapSelection(btn.wrap[0]!, btn.wrap[1]!); }}
              className="px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Start writing here… Supports Markdown formatting."
          className="w-full h-full min-h-[60vh] bg-transparent border-none outline-none resize-none text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 p-0"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported component — uses Tiptap if available, falls back to textarea
// ─────────────────────────────────────────────────────────────────────────────

export function BlockEditor(props: BlockEditorProps) {
  if (TiptapEditor) {
    return <TiptapEditor {...props} />;
  }
  return <FallbackEditor {...props} />;
}
