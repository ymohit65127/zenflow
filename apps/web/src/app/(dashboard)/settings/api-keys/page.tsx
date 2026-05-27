"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Key, AlertTriangle, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { formatDate, timeAgo } from "@/lib/utils";

type Scope = "read" | "write" | "admin";
const SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: "read", label: "Read", description: "Read access to all resources" },
  { value: "write", label: "Write", description: "Create and update resources" },
  { value: "admin", label: "Admin", description: "Full access including deletions" },
];

export default function ApiKeysPage() {
  const utils = api.useUtils();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(["read"]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = api.settings.apiKeys.list.useQuery();

  const createMutation = api.settings.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setGeneratedKey(data.fullKey);
      void utils.settings.apiKeys.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = api.settings.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("API key revoked.");
      setRevokeKeyId(null);
      void utils.settings.apiKeys.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name.");
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error("Select at least one scope.");
      return;
    }
    createMutation.mutate({ name: newKeyName, scopes: selectedScopes });
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    void navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("API key copied to clipboard.");
  };

  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setNewKeyName("");
    setSelectedScopes(["read"]);
    setGeneratedKey(null);
    setCopied(false);
  };

  const toggleScope = (scope: Scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const revokeKey = apiKeys?.find((k) => k.id === revokeKeyId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Generate New Key
        </Button>
      </div>

      {/* Keys table */}
      {apiKeys && apiKeys.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-sm">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {key.key_prefix}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(key.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.last_used_at ? timeAgo(key.last_used_at) : "Never"}
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
      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Your API key has been generated. Copy it now — you won't see it again."
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
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseCreate}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Server"
                />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                {SCOPES.map((scope) => (
                  <div key={scope.value} className="flex items-start gap-3">
                    <Checkbox
                      id={`scope-${scope.value}`}
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                    />
                    <div>
                      <label
                        htmlFor={`scope-${scope.value}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {scope.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{scope.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreate}>
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
      <Dialog open={!!revokeKeyId} onOpenChange={(open) => !open && setRevokeKeyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke{" "}
              <strong>&quot;{revokeKey?.name}&quot;</strong>? Any application using this key
              will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeKeyId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={revokeMutation.isPending}
              onClick={() =>
                revokeKeyId && revokeMutation.mutate({ keyId: revokeKeyId })
              }
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
