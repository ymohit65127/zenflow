"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Boxes,
  Edit2,
  Trash2,
  X,
  Loader2,
  Globe,
  Lock,
  Users,
  FileText,
} from "lucide-react";

type Visibility = "private" | "team" | "org";

const VISIBILITY_META: Record<Visibility, { label: string; icon: React.ReactNode; desc: string }> = {
  private: { label: "Private", icon: <Lock className="w-3.5 h-3.5" />, desc: "Only you" },
  team: { label: "Team", icon: <Users className="w-3.5 h-3.5" />, desc: "Your team members" },
  org: { label: "Organisation", icon: <Globe className="w-3.5 h-3.5" />, desc: "Everyone in org" },
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

const PRESET_ICONS = ["📄", "📚", "🗂️", "💼", "🚀", "🎯", "🧪", "🛠️", "📊", "🎨"];

interface SpaceFormData {
  name: string;
  icon: string;
  color: string;
  description: string;
  visibility: Visibility;
}

const DEFAULT_FORM: SpaceFormData = {
  name: "",
  icon: "📄",
  color: "#6366f1",
  description: "",
  visibility: "org",
};

export default function SpacesPage() {
  const utils = api.useUtils();

  const { data: spaces = [], isLoading } = api.documents.spaces.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SpaceFormData>(DEFAULT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const createMutation = api.documents.spaces.create.useMutation({
    onSuccess: () => {
      toast.success("Space created");
      void utils.documents.spaces.list.invalidate();
      setShowCreate(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.documents.spaces.update.useMutation({
    onSuccess: () => {
      toast.success("Space updated");
      void utils.documents.spaces.list.invalidate();
      setEditId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.documents.spaces.delete.useMutation({
    onSuccess: () => {
      toast.success("Space deleted");
      void utils.documents.spaces.list.invalidate();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(space: typeof spaces[number]) {
    setForm({
      name: space.name,
      icon: space.icon ?? "📄",
      color: space.color ?? "#6366f1",
      description: space.description ?? "",
      visibility: space.visibility as Visibility,
    });
    setEditId(space.id);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const showForm = showCreate || !!editId;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/documents"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Spaces</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Organise your documents into collaborative spaces
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); setForm(DEFAULT_FORM); }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Space
        </button>
      </div>

      {/* Spaces grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Boxes className="w-8 h-8 text-brand-500" />
          </div>
          <div>
            <h3 className="font-semibold">No spaces yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create a space to organise your documents by topic, team, or project.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => {
            const vis = VISIBILITY_META[space.visibility as Visibility] ?? VISIBILITY_META.org;
            const docCount = (space as { _count?: { documents: number } })._count?.documents ?? 0;
            return (
              <div
                key={space.id}
                className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/20 transition-all group relative"
              >
                {/* Color indicator */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: space.color ?? "#6366f1" }}
                />

                <div className="flex items-start gap-3 mb-3 pt-1">
                  <span className="text-2xl leading-none">{space.icon ?? "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{space.name}</h3>
                    {space.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{space.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">{vis.icon}{vis.label}</span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {docCount} doc{docCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(space)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit space"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(space.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete space"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">{editId ? "Edit Space" : "New Space"}</h2>
              <button onClick={() => { setShowCreate(false); setEditId(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Icon + Name row */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span
                    className="text-2xl w-12 h-12 rounded-xl border border-border bg-muted flex items-center justify-center cursor-pointer"
                    title="Click to change icon"
                  >
                    {form.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Engineering Docs"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setForm((f) => ({ ...f, icon }))}
                      className={cn(
                        "w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                        form.icon === icon ? "bg-brand-500/20 ring-2 ring-brand-500" : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Color</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setForm((f) => ({ ...f, color }))}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all",
                        form.color === color ? "ring-2 ring-offset-2 ring-offset-card ring-foreground/30 scale-110" : ""
                      )}
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is this space for?"
                  rows={2}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(VISIBILITY_META) as Array<[Visibility, typeof VISIBILITY_META[Visibility]]>).map(([vis, meta]) => (
                    <button
                      key={vis}
                      onClick={() => setForm((f) => ({ ...f, visibility: vis }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all",
                        form.visibility === vis
                          ? "border-brand-500 bg-brand-500/10 text-brand-600"
                          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {meta.icon}
                      <span>{meta.label}</span>
                      <span className="text-muted-foreground font-normal">{meta.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowCreate(false); setEditId(null); }}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !form.name.trim()}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Save Changes" : "Create Space"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-semibold text-lg mb-2">Delete Space?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              All documents in this space will be archived. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteConfirm })}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
