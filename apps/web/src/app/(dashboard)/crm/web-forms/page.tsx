// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormInput,
  Plus,
  Copy,
  MoreHorizontal,
  Users,
  Globe,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_FIELDS = [
  { key: "first_name", label: "First Name", type: "text" as const, required: true },
  { key: "last_name", label: "Last Name", type: "text" as const, required: false },
  { key: "email", label: "Email", type: "email" as const, required: true },
  { key: "phone", label: "Phone", type: "phone" as const, required: false },
  { key: "company", label: "Company", type: "text" as const, required: false },
];

function CreateFormDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    pipelineId: "",
    successMessage: "Thank you! We'll be in touch soon.",
    isActive: true,
  });

  const { data: pipelines } = api.crm.pipelines.list.useQuery();

  const createMutation = api.crm.webforms.create.useMutation({
    onSuccess: () => {
      toast.success("Web form created");
      setOpen(false);
      setForm({ name: "", pipelineId: "", successMessage: "Thank you! We'll be in touch soon.", isActive: true });
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Form
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Web Form</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Form Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contact Us Form"
            />
          </div>
          <div>
            <Label>Route to Pipeline</Label>
            <Select value={form.pipelineId} onValueChange={(v) => setForm({ ...form, pipelineId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select pipeline (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No pipeline</SelectItem>
                {pipelines?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Success Message</Label>
            <Input
              value={form.successMessage}
              onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
            Default fields will be added: Name, Email, Phone, Company.
            You can customize after creation.
          </p>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.name || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                name: form.name,
                pipeline_id: form.pipelineId || undefined,
                fields: DEFAULT_FIELDS,
                success_message: form.successMessage,
                is_active: form.isActive,
              })
            }
          >
            {createMutation.isPending ? "Creating..." : "Create Form"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WebFormsPage() {
  const { data: forms, isLoading, refetch } = api.crm.webforms.list.useQuery();

  const deleteMutation = api.crm.webforms.delete.useMutation({
    onSuccess: () => { toast.success("Form deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.crm.webforms.update.useMutation({
    onSuccess: () => { toast.success("Updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  function copyEmbedCode(embedKey: string) {
    const code = `<script src="https://app.zenflow.io/embed/forms/${embedKey}.js"></script>\n<div id="zenflow-form-${embedKey}"></div>`;
    navigator.clipboard.writeText(code).then(() => toast.success("Embed code copied!"));
  }

  function copyFormUrl(embedKey: string) {
    const url = `${window.location.origin}/forms/${embedKey}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Form URL copied!"));
  }

  const totalSubmissions = forms?.reduce((sum, f) => sum + f.submissions_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FormInput className="w-6 h-6 text-brand-500" />
            Web Forms
          </h1>
          <p className="text-muted-foreground mt-1">
            {forms?.length ?? 0} forms · {totalSubmissions} total submissions
          </p>
        </div>
        <CreateFormDialog onCreated={() => refetch()} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !forms || forms.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <FormInput className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">No web forms yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create embeddable forms to capture leads</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <Card key={form.id} className="hover:border-brand-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold">{form.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {form.is_active ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">Inactive</Badge>
                      )}
                      {form.pipeline && (
                        <span className="text-xs text-muted-foreground">{form.pipeline.name}</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copyFormUrl(form.embed_key)}>
                        <Globe className="w-3.5 h-3.5 mr-2" /> Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyEmbedCode(form.embed_key)}>
                        <Copy className="w-3.5 h-3.5 mr-2" /> Copy Embed Code
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: form.id, data: { is_active: !form.is_active } })}
                      >
                        {form.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete this form?")) {
                            deleteMutation.mutate({ id: form.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-2xl font-bold text-foreground ml-1">{form.submissions_count}</span>
                    <span className="text-sm ml-1">submissions</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => copyEmbedCode(form.embed_key)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy Embed Code
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => copyFormUrl(form.embed_key)}
                    >
                      <Globe className="w-3.5 h-3.5 mr-1" /> Form URL
                    </Button>
                    <Link href={`/forms/${form.embed_key}`} target="_blank" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Preview
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
