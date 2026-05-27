import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  Users, TrendingUp, CheckCircle2, AlertCircle,
  DollarSign, Kanban, UserCheck, Headphones,
  ArrowUpRight, ArrowDownRight, Plus
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { label: "Total Contacts", value: "2,847", change: "+12%", trend: "up", icon: Users, color: "brand" },
  { label: "Open Deals", value: "$384,500", change: "+8.2%", trend: "up", icon: DollarSign, color: "violet" },
  { label: "Active Projects", value: "24", change: "+3", trend: "up", icon: Kanban, color: "cyan" },
  { label: "Open Tickets", value: "18", change: "-5", trend: "down", icon: Headphones, color: "amber" },
];

const recentActivity = [
  { type: "crm", text: "New lead from Acme Corp", time: "2m ago", color: "brand" },
  { type: "project", text: "Sprint 3 completed", time: "1h ago", color: "cyan" },
  { type: "ticket", text: "Ticket #1284 resolved", time: "3h ago", color: "green" },
  { type: "invoice", text: "Invoice #INV-0089 paid", time: "5h ago", color: "violet" },
  { type: "hr", text: "John Smith joined the team", time: "1d ago", color: "amber" },
];

const quickActions = [
  { label: "Add Contact", href: "/crm/contacts/new", icon: Users },
  { label: "New Task", href: "/projects", icon: Kanban },
  { label: "Create Ticket", href: "/helpdesk/new", icon: Headphones },
  { label: "New Invoice", href: "/accounting/invoices/new", icon: DollarSign },
];

export default async function DashboardPage() {
  const session = await auth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {session?.user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening across your workspace today.
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.slice(0, 2).map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="hidden sm:flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                stat.color === "brand" ? "bg-brand-500/10" :
                stat.color === "violet" ? "bg-violet-500/10" :
                stat.color === "cyan" ? "bg-cyan-500/10" : "bg-amber-500/10"
              }`}>
                <stat.icon className={`w-5 h-5 ${
                  stat.color === "brand" ? "text-brand-500" :
                  stat.color === "violet" ? "text-violet-500" :
                  stat.color === "cyan" ? "text-cyan-500" : "text-amber-500"
                }`} />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full ${
                stat.trend === "up"
                  ? "text-green-600 bg-green-500/10"
                  : "text-red-500 bg-red-500/10"
              }`}>
                {stat.trend === "up"
                  ? <ArrowUpRight className="w-3 h-3" />
                  : <ArrowDownRight className="w-3 h-3" />
                }
                {stat.change}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-muted-foreground text-sm mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Recent Activity</h2>
            <Link href="/audit" className="text-sm text-brand-500 hover:underline">View all</Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  activity.color === "brand" ? "bg-brand-500" :
                  activity.color === "cyan" ? "bg-cyan-500" :
                  activity.color === "green" ? "bg-green-500" :
                  activity.color === "violet" ? "bg-violet-500" : "bg-amber-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions + tasks */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
                    <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 transition-colors" />
                  </div>
                  <span className="text-xs text-center font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Module status */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-lg mb-4">Module Status</h2>
            <div className="space-y-2">
              {[
                { name: "CRM", status: "active", icon: Users },
                { name: "Projects", status: "active", icon: Kanban },
                { name: "HR", status: "active", icon: UserCheck },
                { name: "Helpdesk", status: "warning", icon: Headphones },
                { name: "Analytics", status: "active", icon: TrendingUp },
              ].map((module) => (
                <div key={module.name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <module.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{module.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {module.status === "active" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={`text-xs ${module.status === "active" ? "text-green-600" : "text-amber-600"}`}>
                      {module.status === "active" ? "Active" : "Needs attention"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
