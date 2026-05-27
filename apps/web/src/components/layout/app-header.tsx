"use client";

import { useState } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, User, Settings, Command } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

interface AppHeaderProps {
  user: Session["user"];
}

export function AppHeader({ user }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center gap-4 px-6 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-9 pr-16 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-xs text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium leading-tight">{user?.name ?? "User"}</div>
              <div className="text-xs text-muted-foreground leading-tight">{user?.email ?? ""}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                {[
                  { icon: User, label: "Profile", href: "/settings/profile" },
                  { icon: Settings, label: "Settings", href: "/settings" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </a>
                ))}
                <div className="border-t border-border mt-1">
                  <button
                    onClick={() => { void signOut({ callbackUrl: "/login" }); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
