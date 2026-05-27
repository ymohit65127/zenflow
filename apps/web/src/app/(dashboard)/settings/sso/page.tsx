"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, Loader2, Shield, ToggleLeft, AlertCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SsoProvider = "saml" | "oidc" | "google_workspace" | "microsoft" | "okta" | "auth0";

const PROVIDERS: { value: SsoProvider; label: string; description: string }[] = [
  { value: "saml", label: "SAML 2.0", description: "Generic SAML identity provider" },
  { value: "oidc", label: "OIDC / OAuth 2.0", description: "Generic OpenID Connect provider" },
  { value: "google_workspace", label: "Google Workspace", description: "Sign in with Google" },
  { value: "microsoft", label: "Microsoft Entra ID", description: "Azure AD / Microsoft 365" },
  { value: "okta", label: "Okta", description: "Okta Identity Platform" },
  { value: "auth0", label: "Auth0", description: "Auth0 by Okta" },
];

function SamlForm({
  config,
  onChange,
}: {
  config: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>IdP Metadata URL</Label>
        <Input
          value={config.idp_url ?? ""}
          onChange={(e) => onChange("idp_url", e.target.value)}
          placeholder="https://your-idp.com/metadata"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Entity ID (SP)</Label>
        <Input
          value={config.entity_id ?? ""}
          onChange={(e) => onChange("entity_id", e.target.value)}
          placeholder="https://app.zenflow.io"
        />
      </div>
      <div className="space-y-1.5">
        <Label>IdP X.509 Certificate</Label>
        <textarea
          value={config.x509_cert ?? ""}
          onChange={(e) => onChange("x509_cert", e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
        <p className="font-medium">ACS (Callback) URL to configure in your IdP:</p>
        <code className="font-mono text-foreground">
          {typeof window !== "undefined" ? window.location.origin : "https://app.zenflow.io"}
          /api/auth/sso/saml/callback
        </code>
      </div>
    </div>
  );
}

function OidcForm({
  config,
  onChange,
}: {
  config: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Discovery / Issuer URL</Label>
        <Input
          value={config.discovery_url ?? ""}
          onChange={(e) => onChange("discovery_url", e.target.value)}
          placeholder="https://accounts.google.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client ID</Label>
        <Input
          value={config.client_id ?? ""}
          onChange={(e) => onChange("client_id", e.target.value)}
          placeholder="1234567890.apps.googleusercontent.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client Secret</Label>
        <Input
          type="password"
          value={config.client_secret ?? ""}
          onChange={(e) => onChange("client_secret", e.target.value)}
          placeholder="••••••••••••••••"
        />
      </div>
    </div>
  );
}

function MicrosoftForm({
  config,
  onChange,
}: {
  config: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tenant ID</Label>
        <Input
          value={config.tenant_id ?? ""}
          onChange={(e) => onChange("tenant_id", e.target.value)}
          placeholder="your-tenant-id"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client ID</Label>
        <Input
          value={config.client_id ?? ""}
          onChange={(e) => onChange("client_id", e.target.value)}
          placeholder="Application (client) ID"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client Secret</Label>
        <Input
          type="password"
          value={config.client_secret ?? ""}
          onChange={(e) => onChange("client_secret", e.target.value)}
          placeholder="••••••••••••••••"
        />
      </div>
    </div>
  );
}

function OktaForm({
  config,
  onChange,
}: {
  config: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Okta Domain</Label>
        <Input
          value={config.domain ?? ""}
          onChange={(e) => onChange("domain", e.target.value)}
          placeholder="your-company.okta.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client ID</Label>
        <Input
          value={config.client_id ?? ""}
          onChange={(e) => onChange("client_id", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Client Secret</Label>
        <Input
          type="password"
          value={config.client_secret ?? ""}
          onChange={(e) => onChange("client_secret", e.target.value)}
          placeholder="••••••••••••••••"
        />
      </div>
    </div>
  );
}

export default function SsoSettingsPage() {
  const utils = api.useUtils();

  const { data: ssoConfig, isLoading } = api.platform.sso.get.useQuery();

  const [provider, setProvider] = useState<SsoProvider>("oidc");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [requireSso, setRequireSso] = useState(false);
  const [domainHint, setDomainHint] = useState("");

  const configureMutation = api.platform.sso.configure.useMutation({
    onSuccess: () => {
      toast.success("SSO configuration saved.");
      void utils.platform.sso.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = api.platform.sso.toggle.useMutation({
    onSuccess: () => {
      toast.success("SSO status updated.");
      void utils.platform.sso.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = api.platform.sso.delete.useMutation({
    onSuccess: () => {
      toast.success("SSO configuration removed.");
      void utils.platform.sso.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateConfig = (k: string, v: string) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const handleSave = () => {
    configureMutation.mutate({
      provider,
      config,
      require_sso: requireSso,
      domain_hint: domainHint
        ? domainHint
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Single Sign-On (SSO)</h2>
        <p className="text-sm text-muted-foreground">
          Configure SAML 2.0 or OIDC for organization-wide SSO.
        </p>
      </div>

      {/* Current status */}
      {ssoConfig && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">
                    {PROVIDERS.find((p) => p.value === ssoConfig.provider)?.label ?? ssoConfig.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ssoConfig.require_sso ? "All users must use SSO" : "Optional SSO"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={ssoConfig.is_enabled ? "success" : "secondary"}>
                  {ssoConfig.is_enabled ? "Active" : "Disabled"}
                </Badge>
                <Switch
                  checked={ssoConfig.is_enabled}
                  onCheckedChange={(v) => toggleMutation.mutate({ is_enabled: v })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configure Provider</CardTitle>
          <CardDescription>
            Set up a new or update your existing SSO configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Protocol</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as SsoProvider);
                setConfig({});
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <span className="font-medium">{p.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{p.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {provider === "saml" && <SamlForm config={config} onChange={updateConfig} />}
          {(provider === "oidc" || provider === "google_workspace") && (
            <OidcForm config={config} onChange={updateConfig} />
          )}
          {provider === "microsoft" && <MicrosoftForm config={config} onChange={updateConfig} />}
          {(provider === "okta" || provider === "auth0") && (
            <OktaForm config={config} onChange={updateConfig} />
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require SSO</p>
                <p className="text-xs text-muted-foreground">
                  Force all users to authenticate via SSO
                </p>
              </div>
              <Switch checked={requireSso} onCheckedChange={setRequireSso} />
            </div>

            <div className="space-y-1.5">
              <Label>Domain Hints (comma-separated)</Label>
              <Input
                value={domainHint}
                onChange={(e) => setDomainHint(e.target.value)}
                placeholder="company.com, corp.company.com"
              />
              <p className="text-xs text-muted-foreground">
                Auto-redirect users with matching email domains to SSO login.
              </p>
            </div>
          </div>

          {requireSso && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Enabling "Require SSO" will prevent password-based login for all users.
                Make sure SSO is working before enabling this.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            {ssoConfig && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                loading={deleteMutation.isPending}
              >
                Remove Configuration
              </Button>
            )}
            <Button
              onClick={handleSave}
              loading={configureMutation.isPending}
              className="ml-auto"
            >
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
