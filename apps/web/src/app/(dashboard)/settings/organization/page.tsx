"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "hi", label: "Hindi" },
];

export default function OrganizationSettingsPage() {
  const utils = api.useUtils();
  const { data: org, isLoading } = api.settings.org.get.useQuery();

  const [form, setForm] = useState({
    name: "",
    timezone: "UTC",
    currency: "USD",
    locale: "en",
    domain: "",
  });

  const [synced, setSynced] = useState(false);
  if (org && !synced) {
    setForm({
      name: org.name ?? "",
      timezone: org.timezone ?? "UTC",
      currency: org.currency ?? "USD",
      locale: org.locale ?? "en",
      domain: org.domain ?? "",
    });
    setSynced(true);
  }

  const updateMutation = api.settings.org.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated successfully.");
      void utils.settings.org.get.invalidate();
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Organization</h2>
        <p className="text-sm text-muted-foreground">Manage your organization details and preferences.</p>
      </div>

      {/* Logo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Building2 className="w-8 h-8 text-brand-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{org?.name}</p>
              <div className="text-xs text-muted-foreground mb-2">
                Plan:{" "}
                <Badge variant="default" className="ml-1 text-xs">
                  {org?.plan}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Logo upload coming soon.")}
              >
                Upload Logo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization Details</CardTitle>
          <CardDescription>Update your organization name, domain, and regional settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Inc."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">zenflow.app/</span>
              <Input
                value={org?.slug ?? ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-default"
              />
            </div>
            <p className="text-xs text-muted-foreground">Workspace URL cannot be changed.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domain">Custom Domain</Label>
            <Input
              id="domain"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="acme.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default Language</Label>
              <Select
                value={form.locale}
                onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={() =>
                updateMutation.mutate({
                  name: form.name,
                  timezone: form.timezone,
                  currency: form.currency,
                  locale: form.locale,
                  domain: form.domain || null,
                })
              }
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
