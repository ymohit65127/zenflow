"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Building2,
  Users,
  ShieldCheck,
  KeyRound,
  CreditCard,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Profile", href: "/settings/profile", icon: User },
  { label: "Organization", href: "/settings/organization", icon: Building2 },
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Security", href: "/settings/security", icon: ShieldCheck },
  { label: "API Keys", href: "/settings/api-keys", icon: KeyRound },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account, organization, team, and integrations.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left nav */}
        <aside className="w-52 shrink-0">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-500/10 text-brand-600"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
