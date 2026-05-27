"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Shield, Users, Loader2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MODULES = [
  "crm",
  "projects",
  "hr",
  "helpdesk",
  "accounting",
  "inventory",
  "forms",
  "analytics",
  "documents",
  "chat",
  "workflows",
  "settings",
];

const ACTIONS = ["view", "create", "edit", "delete", "export", "admin"] as const;
type Action = (typeof ACTIONS)[number];

function hasPermission(rolePermissions: any[], module: string, action: Action): boolean {
  return rolePermissions.some(
    (rp: any) =>
      rp.permission?.module === module && rp.permission?.action === action
  );
}

function findRolePermissionId(rolePermissions: any[], module: string, action: Action): string | null {
  const rp = rolePermissions.find(
    (rp: any) => rp.permission?.module === module && rp.permission?.action === action
  );
  return rp?.id ?? null;
}

export default function RolesSettingsPage() {
  const utils = api.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  const { data: roles, isLoading } = api.platform.roles.list.useQuery();

  const createMutation = api.platform.roles.create.useMutation({
    onSuccess: () => {
      toast.success("Role created.");
      setCreateOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      void utils.platform.roles.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.platform.roles.delete.useMutation({
    onSuccess: () => {
      toast.success("Role deleted.");
      setDeleteRoleId(null);
      if (selectedRole === deleteRoleId) setSelectedRole(null);
      void utils.platform.roles.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const setPermMutation = api.platform.roles.setPermission.useMutation({
    onSuccess: () => void utils.platform.roles.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const revokePermMutation = api.platform.roles.revokePermission.useMutation({
    onSuccess: () => void utils.platform.roles.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const activeRole = roles?.find((r: any) => r.id === selectedRole);

  const togglePermission = (module: string, action: Action) => {
    if (!selectedRole || !activeRole) return;
    const existingId = findRolePermissionId(activeRole.role_permissions, module, action);
    if (existingId) {
      revokePermMutation.mutate({ id: existingId });
    } else {
      setPermMutation.mutate({ role_id: selectedRole, module, action });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Manage roles and configure per-module access for your team.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New Role
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Roles ({roles?.length ?? 0})
          </p>
          {roles?.map((role: any) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                selectedRole === role.id
                  ? "border-brand-500 bg-brand-500/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{role.name}</span>
                  {role.is_system && (
                    <Badge variant="outline" className="text-xs py-0">
                      System
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {role._count?.user_roles ?? 0}
                  </span>
                  {!role.is_system && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteRoleId(role.id);
                      }}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {role.description && (
                <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
                  {role.description}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Permission matrix */}
        <div className="lg:col-span-2">
          {selectedRole && activeRole ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Permissions — {activeRole.name}</CardTitle>
                <CardDescription>Check actions to grant access to each module.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Module</TableHead>
                      {ACTIONS.map((a) => (
                        <TableHead key={a} className="text-center capitalize w-16">
                          {a}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES.map((mod) => (
                      <TableRow key={mod}>
                        <TableCell className="font-medium capitalize text-sm">{mod}</TableCell>
                        {ACTIONS.map((action) => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={hasPermission(activeRole.role_permissions, mod, action)}
                              disabled={
                                activeRole.is_system ||
                                setPermMutation.isPending ||
                                revokePermMutation.isPending
                              }
                              onCheckedChange={() => togglePermission(mod, action)}
                              className="mx-auto"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 border border-dashed rounded-xl">
              <Shield className="w-8 h-8" />
              <p className="text-sm">Select a role to edit permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Create role dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Add a new role to assign to team members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Sales Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="e.g. Can manage CRM and view reports"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ name: newRoleName, description: newRoleDesc || undefined })}
              disabled={!newRoleName.trim()}
              loading={createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteRoleId} onOpenChange={(o) => !o && setDeleteRoleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              This will permanently delete the role and remove it from all assigned members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoleId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteRoleId && deleteMutation.mutate({ id: deleteRoleId })}
            >
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
