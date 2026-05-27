"use client";

import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const NOTIFICATION_GROUPS = [
  {
    title: "Projects & Tasks",
    items: [
      { id: "task_assigned", label: "Task assigned to me" },
      { id: "task_due", label: "Task due date approaching" },
      { id: "task_completed", label: "Task completed" },
      { id: "project_update", label: "Project status changes" },
    ],
  },
  {
    title: "Team",
    items: [
      { id: "team_invite", label: "New member joins workspace" },
      { id: "mention", label: "Someone mentions me" },
      { id: "comment", label: "Comment on my tasks" },
    ],
  },
  {
    title: "Billing & Security",
    items: [
      { id: "billing_renewal", label: "Upcoming renewal" },
      { id: "new_login", label: "New login from unrecognized device" },
      { id: "api_key_used", label: "API key used" },
    ],
  },
];

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control which notifications you receive via email and in-app.
        </p>
      </div>

      {NOTIFICATION_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item, idx) => (
              <div key={item.id}>
                <div className="flex items-center justify-between">
                  <Label htmlFor={item.id} className="text-sm font-normal cursor-pointer">
                    {item.label}
                  </Label>
                  <Switch
                    id={item.id}
                    defaultChecked
                    onCheckedChange={() =>
                      toast.info("Notification preferences coming soon.")
                    }
                  />
                </div>
                {idx < group.items.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={() => toast.info("Notification preferences coming soon.")}>
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
