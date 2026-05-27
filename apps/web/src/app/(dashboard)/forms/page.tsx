import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Forms Builder" };

export default function FormsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forms Builder</h1>
        <p className="text-muted-foreground mt-1">
          Design and publish custom forms, surveys, and data-collection workflows
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-5 max-w-lg">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
          <FileText className="w-8 h-8 text-brand-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground text-sm mt-1">
            This module is being built. The Forms Builder will let you create drag-and-drop forms
            with conditional logic, validations, and response analytics.
          </p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Build progress</span>
            <span>25%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 rounded-full bg-brand-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
