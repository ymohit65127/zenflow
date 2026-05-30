"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Shield,
  MonitorSmartphone,
  Smartphone,
  QrCode,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

// MFA setup wizard
function MfaWizard({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const [step, setStep] = useState<"scan" | "verify" | "backup">("scan");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const setupMutation = api.platform.mfa.setupTotp.useMutation({
    onSuccess: (data) => {
      setQrData(data);
    },
    onError: (e) => toast.error(e.message),
  });

  const verifyMutation = api.platform.mfa.verifyTotpSetup.useMutation({
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      setStep("backup");
      void utils.platform.mfa.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-start setup
  useState(() => {
    setupMutation.mutate();
  });

  const copyAllBackup = () => {
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {step === "scan"
            ? "Set up Authenticator App"
            : step === "verify"
            ? "Verify your code"
            : "Save backup codes"}
        </DialogTitle>
        <DialogDescription>
          {step === "scan"
            ? "Scan the QR code with Google Authenticator, Authy, or any TOTP app."
            : step === "verify"
            ? "Enter the 6-digit code from your authenticator app."
            : "Save these codes somewhere safe. Each can only be used once."}
        </DialogDescription>
      </DialogHeader>

      {step === "scan" && (
        <div className="space-y-4">
          {setupMutation.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : qrData ? (
            <>
              <div className="flex justify-center p-4 rounded-xl border border-border bg-white">
                <img
                  src={qrData.qrCode.startsWith('data:image/svg+xml')
                    ? `data:image/svg+xml;base64,${Buffer.from(decodeURIComponent(qrData.qrCode.replace('data:image/svg+xml;utf8,', ''))).toString('base64')}`
                    : qrData.qrCode
                  }
                  alt="TOTP QR Code"
                  className="w-40 h-40 border rounded"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">
                  Can't scan? Enter this key manually:
                </p>
                <code className="block text-center text-xs font-mono bg-muted rounded p-2 break-all">
                  {qrData.secret}
                </code>
              </div>
              <DialogFooter>
                <Button onClick={() => setStep("verify")} className="w-full">
                  I've scanned the code
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>6-digit code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-xl tracking-widest font-mono"
              maxLength={6}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => verifyMutation.mutate({ code })}
              disabled={code.length !== 6}
              loading={verifyMutation.isPending}
              className="w-full"
            >
              Verify & Enable
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === "backup" && (
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              Store these in a password manager. If you lose your phone, use one of these to sign in.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <code key={i} className="text-sm font-mono bg-muted rounded px-3 py-1.5 text-center">
                {code}
              </code>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={copyAllBackup}>
            {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy all codes
          </Button>
          <DialogFooter>
            <Button onClick={onClose} className="w-full">
              I've saved my backup codes
            </Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

export default function SecuritySettingsPage() {
  const utils = api.useUtils();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [disableMfaOpen, setDisableMfaOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  const { data: profile } = api.settings.profile.get.useQuery();
  const { data: mfaStatus } = api.platform.mfa.getStatus.useQuery();
  const { data: sessions } = api.platform.mfa.listSessions.useQuery();

  const changePasswordMutation = api.settings.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMfaMutation = api.platform.mfa.disable.useMutation({
    onSuccess: () => {
      toast.success("MFA disabled.");
      setDisableMfaOpen(false);
      setDisableCode("");
      void utils.platform.mfa.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeSessionMutation = api.platform.mfa.revokeSession.useMutation({
    onSuccess: () => {
      toast.success("Session revoked.");
      void utils.platform.mfa.listSessions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeAllMutation = api.platform.mfa.revokeAllOtherSessions.useMutation({
    onSuccess: () => {
      toast.success("All other sessions revoked.");
      void utils.platform.mfa.listSessions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const strength = getPasswordStrength(form.newPassword);

  const handleChangePassword = () => {
    if (form.newPassword !== form.confirmPassword) return toast.error("Passwords do not match.");
    if (form.newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    changePasswordMutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage your password, MFA, active sessions, and SSO.
        </p>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Use a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.newPassword && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Strength: <span className="font-medium">{strength.label}</span>
                </p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              loading={changePasswordMutation.isPending}
              disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword}
            >
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MFA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-Factor Authentication (MFA)</CardTitle>
          <CardDescription>Secure your account with a TOTP authenticator app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Authenticator App (TOTP)</p>
                <p className="text-xs text-muted-foreground">
                  {mfaStatus?.is_enabled
                    ? `Enabled ${mfaStatus.enabled_at ? format(new Date(mfaStatus.enabled_at), "MMM dd, yyyy") : ""}`
                    : "Not configured"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={mfaStatus?.is_enabled ? "success" : "secondary"}>
                {mfaStatus?.is_enabled ? "Enabled" : "Disabled"}
              </Badge>
              {mfaStatus?.is_enabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableMfaOpen(true)}
                >
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={() => setMfaDialogOpen(true)}>
                  <Shield className="w-4 h-4" />
                  Set up MFA
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Sessions</CardTitle>
          <CardDescription>Devices and browsers currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions && sessions.length > 0 ? (
            sessions.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {s.device_name ?? "Unknown Device"}
                      {s.is_current && (
                        <Badge variant="success" className="ml-2 text-xs">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ip_address ?? "Unknown IP"} —{" "}
                      {s.last_active_at
                        ? `Last seen ${format(new Date(s.last_active_at), "MMM dd, HH:mm")}`
                        : "—"}
                    </p>
                  </div>
                </div>
                {!s.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => revokeSessionMutation.mutate({ session_id: s.id })}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <MonitorSmartphone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Current Session</p>
                  <p className="text-xs text-muted-foreground">This device — Active now</p>
                </div>
              </div>
              <Badge variant="success">Current</Badge>
            </div>
          )}
          <Separator />
          <Button
            variant="outline"
            size="sm"
            onClick={() => revokeAllMutation.mutate()}
            loading={revokeAllMutation.isPending}
          >
            Sign out all other sessions
          </Button>
        </CardContent>
      </Card>

      {/* SSO link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single Sign-On (SSO)</CardTitle>
          <CardDescription>Configure SAML or OIDC for your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/sso">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Configure SSO
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* MFA Setup Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <MfaWizard onClose={() => setMfaDialogOpen(false)} />
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={disableMfaOpen} onOpenChange={setDisableMfaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable MFA</DialogTitle>
            <DialogDescription>
              Enter your 6-digit authenticator code to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="text-center text-xl tracking-widest font-mono"
            maxLength={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableMfaOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disableMfaMutation.mutate({ code: disableCode })}
              disabled={disableCode.length !== 6}
              loading={disableMfaMutation.isPending}
            >
              Disable MFA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
