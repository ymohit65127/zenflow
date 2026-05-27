import type { Metadata } from "next";
import Link from "next/link";
import { Users, Target, TrendingUp, DollarSign, Plus, ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "CRM" };

const stats = [
  { label: "Total Contacts", value: "2,847", icon: Users, color: "brand" },
  { label: "Active Leads", value: "142", icon: Target, color: "violet" },
  { label: "Open Deals", value: "38", icon: TrendingUp, color: "cyan" },
  { label: "Revenue (MTD)", value: "$84,500", icon: DollarSign, color: "green" },
];

export default function CRMPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Manage your contacts, leads, and deals</p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/contacts/new" className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Contact
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="w-5 h-5 text-brand-500" />
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 border-b border-border pb-0">
        {["Contacts", "Leads", "Deals", "Activities", "Reports"].map((tab, i) => (
          <Link
            key={tab}
            href={`/crm/${tab.toLowerCase()}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              i === 0
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {/* Contacts table placeholder */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">All Contacts</h2>
          <input
            type="search"
            placeholder="Search contacts..."
            className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-60"
          />
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No contacts yet</p>
          <p className="text-sm mt-1">Add your first contact to get started</p>
          <Link href="/crm/contacts/new" className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
