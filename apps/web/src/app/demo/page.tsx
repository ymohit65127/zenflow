"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Play, CheckCircle } from "lucide-react";

const features = [
  "CRM — Contacts, Leads, Deals pipeline",
  "Project Management — Kanban, Sprints, Tasks",
  "HR — Employees, Attendance, Leave",
  "Help Desk — Tickets, SLA, Knowledge Base",
  "Accounting — Invoices, Expenses, P&L",
  "Inventory — Products, Stock, Purchase Orders",
  "Forms Builder — Drag-drop, Submissions",
  "Analytics — Live charts, Custom reports",
  "Workflows — Visual automation builder",
  "Documents — Rich editor, Version history",
  "Team Chat — Channels, DMs",
  "Settings — Org, Team, Billing, API Keys",
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-500">
          <Play className="h-3.5 w-3.5" />
          Live Demo
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Try{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              ZenFlow
            </span>{" "}
            for Free
          </h1>
          <p className="text-muted-foreground text-lg">
            Sign up for a free account and explore all 13 modules with pre-loaded demo data.
          </p>
        </div>

        {/* Features checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
            Start Free Demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            Login with demo@admin.com
          </Link>
        </div>

        {/* Demo credentials */}
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-left space-y-1">
          <p className="font-medium text-foreground">Demo account credentials:</p>
          <p className="text-muted-foreground">Email: <span className="font-mono text-foreground">admin@demo.com</span></p>
          <p className="text-muted-foreground">Password: <span className="font-mono text-foreground">Demo@123456</span></p>
        </div>

        <p className="text-xs text-muted-foreground">
          No credit card required · All features included · Cancel anytime
        </p>
      </div>
    </div>
  );
}
