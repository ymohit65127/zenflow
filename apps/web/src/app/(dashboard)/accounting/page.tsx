"use client";

import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Receipt,
  Plus,
  ArrowUpRight,
  FileText,
  CreditCard,
  BookOpen,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-600",
  VIEWED: "bg-purple-500/10 text-purple-600",
  PARTIAL: "bg-amber-500/10 text-amber-600",
  PAID: "bg-green-500/10 text-green-600",
  OVERDUE: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default function AccountingPage() {
  const { data: stats } = api.accounting.invoices.stats.useQuery();
  const { data: chartData } = api.accounting.invoices.revenueChart.useQuery();
  const { data: recentInvoices } = api.accounting.invoices.list.useQuery({
    limit: 5,
    offset: 0,
  });
  const { data: expenseStats } = api.accounting.expenses.stats.useQuery();

  const statCards = [
    {
      label: "Total Revenue (MTD)",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: TrendingUp,
      color: "text-brand-500",
      bg: "bg-brand-500/10",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats?.outstandingAmount ?? 0),
      icon: DollarSign,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Overdue Invoices",
      value: String(stats?.overdue ?? 0),
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Expenses (MTD)",
      value: formatCurrency(expenseStats?.totalThisMonth ?? 0),
      icon: Receipt,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  const tabs = [
    { label: "Invoices", href: "/accounting/invoices", icon: FileText },
    { label: "Expenses", href: "/accounting/expenses", icon: CreditCard },
    { label: "Chart of Accounts", href: "/accounting/accounts", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounting</h1>
          <p className="text-muted-foreground mt-1">
            Invoices, expenses, and financial reporting
          </p>
        </div>
        <Link
          href="/accounting/invoices/new"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">Revenue Overview</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Last 6 months</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-3 rounded-full bg-brand-500 inline-block" />
            Revenue
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), "Revenue"]}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab, i) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              i === 0
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Recent Invoices</h2>
          <Link
            href="/accounting/invoices"
            className="text-sm text-brand-500 hover:underline"
          >
            View all
          </Link>
        </div>
        {recentInvoices?.items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No invoices yet</p>
            <p className="text-sm mt-1">Create your first invoice to get started</p>
            <Link
              href="/accounting/invoices/new"
              className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Invoice #", "Issue Date", "Due Date", "Amount", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentInvoices?.items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/accounting/invoices/${inv.id}`}
                        className="font-medium text-brand-500 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(inv.issue_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {inv.due_date
                        ? new Date(inv.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[inv.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Draft", value: stats?.draft ?? 0, color: "text-muted-foreground" },
          { label: "Sent / Viewed", value: stats?.sent ?? 0, color: "text-blue-500" },
          { label: "Paid", value: stats?.paid ?? 0, color: "text-green-500" },
          { label: "Overdue", value: stats?.overdue ?? 0, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
