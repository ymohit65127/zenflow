"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Loader2,
  MoreHorizontal,
  Mail,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInitials, generateAvatarColor, formatDate, timeAgo } from "@/lib/utils";
import { useSession } from "next-auth/react";

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const utils = api.useUtils();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  const [removeDialogUserId, setRemoveDialogUserId] = useState<string | null>(null);

  const { data: members, isLoading } = api.settings.team.list.useQuery();
  const { data: invitations } = api.settings.team.listInvitations.useQuery();
  const { data: roles } = api.settings.team.listRoles.useQuery();

  const inviteMutation = api.settings.team.invite.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRoleId("");
      void utils.settings.team.listInvitations.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelInviteMutation = api.settings.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled.");
      void utils.settings.team.listInvitations.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = api.settings.team.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated.");
      void utils.settings.team.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeUserMutation = api.settings.team.removeUser.useMutation({
    onSuccess: () => {
      toast.success("Member removed from organization.");
      setRemoveDialogUserId(null);
      void utils.settings.team.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const memberToRemove = members?.find((m) => m.id === removeDialogUserId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground">
            Manage team members and pending invitations.
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an email invitation to join your workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  inviteMutation.mutate({
                    email: inviteEmail,
                    roleId: inviteRoleId || undefined,
                  })
                }
                loading={inviteMutation.isPending}
                disabled={!inviteEmail}
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => {
              const name = member.name ?? member.email;
              const color = generateAvatarColor(name);
              const roleName = member.user_roles[0]?.role?.name ?? "Member";
              const isCurrentUser = member.id === (session?.user?.id as string);
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatar_url ?? undefined} />
                        <AvatarFallback color={color} className="text-xs">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.name}
                          {member.is_owner && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(Owner)</span>
                          )}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleName}</Badge>
                  </TableCell>
                  <TableCell>
                    {member.is_active ? (
                      <span className="flex items-center gap-1.5 text-sm text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.last_login_at ? timeAgo(member.last_login_at) : "Never"}
                  </TableCell>
                  <TableCell>
                    {!isCurrentUser && !member.is_owner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {roles && roles.length > 0 && (
                            <>
                              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                Change Role
                              </p>
                              {roles.map((role) => (
                                <DropdownMenuItem
                                  key={role.id}
                                  onClick={() =>
                                    updateRoleMutation.mutate({
                                      userId: member.id,
                                      roleId: role.id,
                                    })
                                  }
                                >
                                  {role.name}
                                  {roleName === role.name && (
                                    <span className="ml-auto text-brand-500">✓</span>
                                  )}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRemoveDialogUserId(member.id)}
                          >
                            <X className="w-4 h-4" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pending invitations */}
      {invitations && invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Pending Invitations</h3>
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="text-sm">{invite.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invite.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invite.expires_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          cancelInviteMutation.mutate({ inviteId: invite.id })
                        }
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removeDialogUserId}
        onOpenChange={(open) => !open && setRemoveDialogUserId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{memberToRemove?.name ?? memberToRemove?.email}</strong> from the
              organization? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogUserId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={removeUserMutation.isPending}
              onClick={() =>
                removeDialogUserId &&
                removeUserMutation.mutate({ userId: removeDialogUserId })
              }
            >
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
