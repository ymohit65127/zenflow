import type { Metadata } from "next";
import { Workflow } from "lucide-react";

export const metadata: Metadata = { title: "Workflow Automation" };

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workflow Automation</h1>
        <p className="text-muted-foreground mt-1">
          Build trigger-based automations to streamline repetitive processes across modules
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-5 max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <Workflow className="w-8 h-8 text-purple-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground text-sm mt-1">
            This module is being built. Workflow Automation will let you design no-code trigger-action
            flows, scheduled jobs, and multi-step approval chains across your workspace.
          </p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Build progress</span>
            <span>25%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 rounded-full bg-purple-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
