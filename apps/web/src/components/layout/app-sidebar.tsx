"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Zap, LayoutDashboard, Users, Kanban, FileText, BarChart3,
  UserCheck, Headphones, DollarSign, Package, Workflow,
  FolderOpen, MessageSquare, Settings, ChevronLeft, ChevronRight,
  Puzzle, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Projects", href: "/projects", icon: Kanban },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "HR", href: "/hr", icon: UserCheck },
  { label: "Help Desk", href: "/helpdesk", icon: Headphones },
  { label: "Accounting", href: "/accounting", icon: DollarSign },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Chat", href: "/chat", icon: MessageSquare },
];

const bottomItems = [
  { label: "Integrations", href: "/integrations", icon: Puzzle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-300 z-10",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg gradient-text">ZenFlow</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn(
                      "w-4.5 h-4.5 flex-shrink-0",
                      active ? "text-brand-500" : "text-muted-foreground"
                    )}
                    style={{ width: "1.125rem", height: "1.125rem" }}
                  />
                  {!collapsed && item.label}
                  {active && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Bottom items */}
        <div className="mt-4 border-t border-border pt-4 px-2">
          <ul className="space-y-0.5">
            {bottomItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      active
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      style={{ width: "1.125rem", height: "1.125rem" }}
                      className={cn("flex-shrink-0", active ? "text-brand-500" : "")}
                    />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
