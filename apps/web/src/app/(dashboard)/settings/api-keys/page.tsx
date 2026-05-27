"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Key, AlertTriangle, Check, Info } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SCOPE_OPTIONS = [
  { value: "crm:read", label: "CRM — Read" },
  { value: "crm:write", label: "CRM — Write" },
  { value: "hr:read", label: "HR — Read" },
  { value: "hr:write", label: "HR — Write" },
  { value: "projects:read", label: "Projects — Read" },
  { value: "projects:write", label: "Projects — Write" },
  { value: "helpdesk:read", label: "Helpdesk — Read" },
  { value: "helpdesk:write", label: "Helpdesk — Write" },
  { value: "accounting:read", label: "Accounting — Read" },
  { value: "inventory:read", label: "Inventory — Read" },
];

export default function ApiKeysPage() {
  const utils = api.useUtils();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["crm:read"]);
  const [expireDays, setExpireDays] = useState<string>("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const { data: apiTokens, isLoading } = api.platform.apiTokens.list.useQuery();

  const createMutation = api.platform.apiTokens.create.useMutation({
    onSuccess: (data) => {
      setGeneratedKey(data.raw);
      void utils.platform.apiTokens.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = api.platform.apiTokens.revoke.useMutation({
    onSuccess: () => {
      toast.success("API key revoked.");
      setRevokeKeyId(null);
      void utils.platform.apiTokens.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return toast.error("Please enter a key name.");
    if (selectedScopes.length === 0) return toast.error("Select at least one scope.");
    createMutation.mutate({
      name: newKeyName,
      scopes: selectedScopes,
      expires_in_days: expireDays ? parseInt(expireDays) : undefined,
    });
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    void navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard.");
  };

  const handleClose = () => {
    setCreateDialogOpen(false);
    setNewKeyName("");
    setSelectedScopes(["crm:read"]);
    setExpireDays("");
    setGeneratedKey(null);
    setCopied(false);
  };

  const toggleScope = (scope: string) =>
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );

  const revokeToken = apiTokens?.find((k: any) => k.id === revokeKeyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage API keys for programmatic access to ZenFlow.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Generate New Key
        </Button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-xs dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          API keys grant programmatic access to your ZenFlow data. Keep them secure and never
          commit them to source control.
        </span>
      </div>

      {apiTokens && apiTokens.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiTokens.map((key: any) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-sm">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {key.key_prefix}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-40">
                      {key.scopes.slice(0, 2).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {key.scopes.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{key.scopes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(key.created_at), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.last_used_at ? timeAgo(key.last_used_at) : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.expires_at ? format(new Date(key.expires_at), "MMM dd, yyyy") : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.is_active ? "success" : "secondary"}>
                      {key.is_active ? "Active" : "Revoked"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setRevokeKeyId(key.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Key className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Generate Your First Key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Copy your key now — it won't be shown again."
                : "Create a new API key for programmatic access to ZenFlow."}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <Alert variant="warning">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Copy this key now</AlertTitle>
                <AlertDescription>
                  This key will not be shown again. Store it somewhere safe.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted border border-border px-3 py-2.5 rounded-lg font-mono break-all select-all">
                  {generatedKey}
                </code>
                <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Key Name</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Server"
                />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                  {SCOPE_OPTIONS.map((s) => (
                    <div key={s.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`sc-${s.value}`}
                        checked={selectedScopes.includes(s.value)}
                        onCheckedChange={() => toggleScope(s.value)}
                      />
                      <label htmlFor={`sc-${s.value}`} className="text-sm cursor-pointer">
                        {s.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Expires in (days, optional)</Label>
                <Input
                  type="number"
                  value={expireDays}
                  onChange={(e) => setExpireDays(e.target.value)}
                  placeholder="Never"
                  min={1}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  loading={createMutation.isPending}
                  disabled={!newKeyName.trim() || selectedScopes.length === 0}
                >
                  Generate Key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeKeyId} onOpenChange={(o) => !o && setRevokeKeyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Any application using{" "}
              <strong>&quot;{revokeToken?.name}&quot;</strong> will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeKeyId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={revokeMutation.isPending}
              onClick={() => revokeKeyId && revokeMutation.mutate({ id: revokeKeyId })}
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
