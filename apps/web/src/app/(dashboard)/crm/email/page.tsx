"use client";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mail,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  gmail: { label: "Gmail", color: "bg-red-100 text-red-700" },
  outlook: { label: "Outlook", color: "bg-blue-100 text-blue-700" },
  smtp: { label: "SMTP/IMAP", color: "bg-slate-100 text-slate-700" },
};

export default function EmailIntegrationPage() {
  const { data: integrations, isLoading, refetch } = api.crm.email.getIntegrations.useQuery();
  const { data: stats } = api.crm.email.getStats.useQuery();

  const syncMutation = api.crm.email.syncNow.useMutation({
    onSuccess: () => { toast.success("Email sync triggered"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = api.crm.email.disconnect.useMutation({
    onSuccess: () => { toast.success("Integration disconnected"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 text-brand-500" />
            Email Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your inbox to automatically log emails to CRM contacts and deals
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Emails Logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-green-600">{stats.opened}</p>
              <p className="text-xs text-muted-foreground">Opened</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-red-500">{stats.bounced}</p>
              <p className="text-xs text-muted-foreground">Bounced</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connect options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gmail */}
        <Card className="hover:border-brand-500/40 transition-colors">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold">Gmail</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Connect via Google OAuth for real-time sync using push notifications
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                // In production, redirect to Google OAuth flow
                toast.info("Gmail OAuth integration requires backend configuration");
              }}
            >
              Connect Gmail
            </Button>
          </CardContent>
        </Card>

        {/* Outlook */}
        <Card className="hover:border-brand-500/40 transition-colors">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold">Outlook / Office 365</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Connect via Microsoft Graph API for email sync and tracking
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                toast.info("Outlook OAuth integration requires backend configuration");
              }}
            >
              Connect Outlook
            </Button>
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card className="hover:border-brand-500/40 transition-colors">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-slate-600" />
            </div>
            <h3 className="font-semibold">SMTP / IMAP</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Connect any email server via IMAP polling every 15 minutes
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                toast.info("SMTP/IMAP integration requires backend configuration");
              }}
            >
              Configure SMTP
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Connected integrations */}
      <div>
        <h2 className="font-semibold mb-3">Connected Accounts</h2>
        {isLoading ? (
          <div className="h-24 bg-muted rounded-xl animate-pulse" />
        ) : !integrations || integrations.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Mail className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">No email accounts connected yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect Gmail, Outlook, or SMTP above to start logging emails
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {integrations.map((integration) => {
              const providerConfig = PROVIDER_CONFIG[integration.provider] ?? PROVIDER_CONFIG.smtp;
              return (
                <div key={integration.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{integration.email_address}</p>
                      <Badge className={`text-xs ${providerConfig?.color}`}>
                        {providerConfig?.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {integration.last_synced_at ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" /> Sync enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="w-3 h-3" /> Sync disabled
                        </span>
                      )}
                      {integration.last_synced_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Last sync: {new Date(integration.last_synced_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate({ integrationId: integration.id })}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => {
                        if (confirm("Disconnect this email account?")) {
                          disconnectMutation.mutate({ integrationId: integration.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> How Email Integration Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">1. Connect</p>
            <p>Authorize ZenFlow to access your inbox via OAuth or IMAP credentials</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">2. Auto-Match</p>
            <p>Emails are matched to CRM contacts by email address and logged automatically</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">3. Track</p>
            <p>Open rates, click tracking, and bounce detection are monitored per email</p>
          </div>
        </div>
      </div>
    </div>
  );
}
