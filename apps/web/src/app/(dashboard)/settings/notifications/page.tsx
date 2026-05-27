"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NOTIFICATION_GROUPS = [
  {
    title: "Projects & Tasks",
    items: [
      { id: "task.assigned", label: "Task assigned to me" },
      { id: "task.due_soon", label: "Task due date approaching" },
      { id: "task.completed", label: "Task completed" },
      { id: "project.status_changed", label: "Project status changes" },
      { id: "task.comment", label: "Comment on my tasks" },
    ],
  },
  {
    title: "CRM",
    items: [
      { id: "crm.deal.stage_changed", label: "Deal stage changed" },
      { id: "crm.deal.assigned", label: "Deal assigned to me" },
      { id: "crm.contact.created", label: "New contact created" },
    ],
  },
  {
    title: "Team",
    items: [
      { id: "team.invite.accepted", label: "Invite accepted" },
      { id: "mention", label: "Someone mentions me" },
    ],
  },
  {
    title: "Helpdesk",
    items: [
      { id: "ticket.assigned", label: "Ticket assigned to me" },
      { id: "ticket.reply", label: "Reply on my ticket" },
      { id: "ticket.resolved", label: "Ticket resolved" },
    ],
  },
  {
    title: "Billing & Security",
    items: [
      { id: "billing.renewal", label: "Upcoming renewal" },
      { id: "security.new_login", label: "New login from unrecognized device" },
      { id: "security.api_key_used", label: "API key used" },
    ],
  },
];

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
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function ChannelToggle({
  icon: Icon,
  label,
  checked,
  onChange,
  disabled,
}: {
  icon: any;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className={`w-4 h-4 ${checked ? "text-brand-500" : "text-muted-foreground"}`} />
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const utils = api.useUtils();

  const { data: prefs, isLoading } = api.platform.notifications["preferences.get"].useQuery();

  const setPrefMutation = api.platform.notifications["preferences.set"].useMutation({
    onSuccess: () => void utils.platform.notifications["preferences.get"].invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [quietTz, setQuietTz] = useState("UTC");
  const [quietEnabled, setQuietEnabled] = useState(false);

  const getPref = (eventType: string) => {
    const p = prefs?.find((p: any) => p.event_type === eventType);
    return (p?.channels as { in_app: boolean; email: boolean; sms: boolean; push: boolean }) ?? {
      in_app: true,
      email: true,
      sms: false,
      push: false,
    };
  };

  const toggleChannel = (
    eventType: string,
    channel: "in_app" | "email",
    value: boolean
  ) => {
    const current = getPref(eventType);
    setPrefMutation.mutate({
      event_type: eventType,
      channels: { ...current, [channel]: value },
      quiet_start: quietEnabled ? quietStart : undefined,
      quiet_end: quietEnabled ? quietEnd : undefined,
      timezone: quietEnabled ? quietTz : undefined,
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control which notifications you receive and through which channels.
        </p>
      </div>

      {/* Channel legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" />
          In-app
        </div>
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Email
        </div>
        <div className="flex items-center gap-1.5 opacity-40">
          <MessageSquare className="w-3.5 h-3.5" />
          Slack (coming soon)
        </div>
      </div>

      {NOTIFICATION_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {group.items.map((item, idx) => {
              const channels = getPref(item.id);
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between py-3">
                    <Label className="text-sm font-normal cursor-pointer flex-1">
                      {item.label}
                    </Label>
                    <div className="flex items-center gap-4">
                      <ChannelToggle
                        icon={Bell}
                        label="In-app"
                        checked={channels.in_app}
                        onChange={(v) => toggleChannel(item.id, "in_app", v)}
                      />
                      <ChannelToggle
                        icon={Mail}
                        label="Email"
                        checked={channels.email}
                        onChange={(v) => toggleChannel(item.id, "email", v)}
                      />
                      <ChannelToggle
                        icon={MessageSquare}
                        label="Slack"
                        checked={false}
                        onChange={() => toast.info("Slack notifications coming soon.")}
                        disabled
                      />
                    </div>
                  </div>
                  {idx < group.items.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Quiet hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Quiet Hours</CardTitle>
              <CardDescription className="mt-0.5">
                Pause email, SMS and push notifications during these hours.
              </CardDescription>
            </div>
            <Switch checked={quietEnabled} onCheckedChange={setQuietEnabled} />
          </div>
        </CardHeader>
        {quietEnabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <Select value={quietTz} onValueChange={setQuietTz}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              In-app notifications are always delivered. Only email, SMS and push are silenced.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
