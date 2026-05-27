import type { Metadata } from "next";
import { Headphones } from "lucide-react";

export const metadata: Metadata = { title: "Help Desk" };

export default function HelpDeskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help Desk</h1>
        <p className="text-muted-foreground mt-1">
          Handle support tickets, SLAs, and customer service queues in one place
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-5 max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
          <Headphones className="w-8 h-8 text-cyan-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground text-sm mt-1">
            This module is being built. Help Desk will give your team a unified inbox for tickets,
            auto-assignment rules, canned responses, and SLA breach alerts.
          </p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Build progress</span>
            <span>25%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 rounded-full bg-cyan-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
