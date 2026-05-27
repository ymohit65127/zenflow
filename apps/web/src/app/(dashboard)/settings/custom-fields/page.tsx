"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Loader2, Sliders } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const ENTITY_TABS = [
  { key: "contact", module: "crm", label: "Contacts" },
  { key: "deal", module: "crm", label: "Deals" },
  { key: "task", module: "projects", label: "Tasks" },
  { key: "ticket", module: "helpdesk", label: "Tickets" },
  { key: "employee", module: "hr", label: "Employees" },
  { key: "invoice", module: "accounting", label: "Invoices" },
  { key: "product", module: "inventory", label: "Products" },
] as const;

type EntityTab = (typeof ENTITY_TABS)[number];

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Textarea" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "SELECT", label: "Select" },
  { value: "MULTI_SELECT", label: "Multi-select" },
  { value: "URL", label: "URL" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
];

const FIELD_TYPE_COLORS: Record<string, string> = {
  TEXT: "bg-blue-100 text-blue-700",
  TEXTAREA: "bg-blue-100 text-blue-700",
  NUMBER: "bg-purple-100 text-purple-700",
  DATE: "bg-green-100 text-green-700",
  BOOLEAN: "bg-yellow-100 text-yellow-700",
  SELECT: "bg-orange-100 text-orange-700",
  MULTI_SELECT: "bg-orange-100 text-orange-700",
  URL: "bg-pink-100 text-pink-700",
  EMAIL: "bg-pink-100 text-pink-700",
  PHONE: "bg-pink-100 text-pink-700",
};

const emptyForm = {
  label: "",
  field_key: "",
  field_type: "TEXT" as string,
  is_required: false,
};

function FieldsTab({ tab }: { tab: EntityTab }) {
  const utils = api.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editField, setEditField] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: fields, isLoading } = api.platform.customFields["definitions.list"].useQuery({
    entity_type: tab.key,
    module: tab.module,
  });

  const createMutation = api.platform.customFields["definitions.create"].useMutation({
    onSuccess: () => {
      toast.success("Field created.");
      setCreateOpen(false);
      setForm(emptyForm);
      void utils.platform.customFields["definitions.list"].invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = api.platform.customFields["definitions.update"].useMutation({
    onSuccess: () => {
      toast.success("Field updated.");
      setEditField(null);
      void utils.platform.customFields["definitions.list"].invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.platform.customFields["definitions.delete"].useMutation({
    onSuccess: () => {
      toast.success("Field removed.");
      setDeleteId(null);
      void utils.platform.customFields["definitions.list"].invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (f: any) => {
    setEditField(f);
    setForm({
      label: f.label,
      field_key: f.field_key,
      field_type: f.field_type,
      is_required: f.is_required,
    });
  };

  const handleSave = () => {
    if (!form.label.trim()) return toast.error("Label is required.");
    if (editField) {
      updateMutation.mutate({
        id: editField.id,
        data: { label: form.label, field_type: form.field_type as any, is_required: form.is_required },
      });
    } else {
      createMutation.mutate({
        module: tab.module,
        entity_type: tab.key,
        label: form.label,
        field_key: form.field_key || form.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        field_type: form.field_type as any,
        is_required: form.is_required,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditField(null);
            setForm(emptyForm);
            setCreateOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Add Field
        </Button>
      </div>

      {fields && fields.length > 0 ? (
        <div className="space-y-2">
          {fields.map((field: any) => (
            <div
              key={field.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      FIELD_TYPE_COLORS[field.field_type] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {field.field_type}
                  </span>
                  {field.is_required && (
                    <Badge variant="destructive" className="text-xs py-0">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {field.field_key}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(field)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(field.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Sliders className="w-8 h-8" />
            <p className="text-sm">No custom fields for this entity.</p>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={createOpen || !!editField}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditField(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editField ? "Edit Field" : "Add Custom Field"}</DialogTitle>
            <DialogDescription>
              Configure the field that will appear on {tab.label}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Lead Source"
              />
            </div>
            {!editField && (
              <div className="space-y-1.5">
                <Label>Field Key (snake_case)</Label>
                <Input
                  value={form.field_key}
                  onChange={(e) => setForm((f) => ({ ...f, field_key: e.target.value }))}
                  placeholder="auto-generated from label"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Field Type</Label>
              <Select
                value={form.field_type}
                onValueChange={(v) => setForm((f) => ({ ...f, field_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.is_required}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))}
              />
              <Label className="font-normal">Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditField(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.label.trim()}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editField ? "Save Changes" : "Add Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field</DialogTitle>
            <DialogDescription>
              This will permanently delete the field and its configuration.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomFieldsSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Custom Fields</h2>
        <p className="text-sm text-muted-foreground">
          Add extra fields to any entity type to capture your unique data.
        </p>
      </div>

      <Tabs defaultValue="contact">
        <TabsList className="flex-wrap h-auto gap-1">
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ENTITY_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <FieldsTab tab={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
