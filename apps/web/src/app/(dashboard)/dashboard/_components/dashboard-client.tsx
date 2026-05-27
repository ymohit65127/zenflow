'use client';

import { api } from '@/trpc/react';
import { formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import {
  Users, DollarSign, Kanban, Headphones, TrendingUp,
  ArrowUpRight, ArrowDownRight, Plus, Clock, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const BRAND_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

function KpiCard({
  label, value, sub, icon: Icon, color, trend, change,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'brand' | 'violet' | 'cyan' | 'amber';
  trend?: 'up' | 'down';
  change?: string;
}) {
  const colorMap = {
    brand: { bg: 'bg-brand-500/10', text: 'text-brand-500' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        {trend && change && (
          <span className={`flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full ${
            trend === 'up' ? 'text-green-600 bg-green-500/10' : 'text-red-500 bg-red-500/10'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-muted-foreground text-sm mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="w-16 h-6 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-7 w-28 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

function ChartSkeleton({ h = 'h-64' }: { h?: string }) {
  return (
    <div className={`${h} bg-muted rounded-xl animate-pulse`} />
  );
}

const quickActions = [
  { label: 'Add Contact', href: '/crm', icon: Users },
  { label: 'New Task', href: '/projects', icon: Kanban },
  { label: 'Create Ticket', href: '/helpdesk', icon: Headphones },
  { label: 'New Invoice', href: '/accounting', icon: DollarSign },
];

export function DashboardClient({ greeting, firstName }: { greeting: string; firstName: string }) {
  const overview = api.analytics.overview.useQuery();
  const revenueStats = api.analytics.revenueStats.useQuery();
  const crmStats = api.analytics.crmStats.useQuery();
  const ticketStats = api.analytics.ticketStats.useQuery();
  const topDeals = api.analytics.topDeals.useQuery();
  const recentActivity = api.analytics.recentActivity.useQuery();

  const ov = overview.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {firstName} 👋
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

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total Contacts"
              value={formatNumber(ov?.totalContacts)}
              sub={`+${ov?.newContactsThisMonth ?? 0} this month`}
              icon={Users}
              color="brand"
              trend="up"
              change={`+${ov?.newContactsThisMonth ?? 0}`}
            />
            <KpiCard
              label="Open Deals"
              value={formatCurrency(ov?.totalDealValue)}
              sub={`${ov?.openDeals ?? 0} deals`}
              icon={DollarSign}
              color="violet"
              trend="up"
              change={`${ov?.openDeals ?? 0} open`}
            />
            <KpiCard
              label="Active Projects"
              value={formatNumber(ov?.activeProjects)}
              sub={`${ov?.completedTasksThisWeek ?? 0} tasks done this week`}
              icon={Kanban}
              color="cyan"
              trend="up"
              change={`+${ov?.completedTasksThisWeek ?? 0}`}
            />
            <KpiCard
              label="Open Tickets"
              value={formatNumber(ov?.openTickets)}
              sub={`${ov?.resolvedTicketsThisMonth ?? 0} resolved this month`}
              icon={Headphones}
              color="amber"
              trend={ov?.openTickets && ov.openTickets > 10 ? 'up' : 'down'}
              change={`${ov?.resolvedTicketsThisMonth ?? 0} resolved`}
            />
          </>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">Revenue Overview</h2>
            <p className="text-sm text-muted-foreground">Last 12 months · Total paid invoices</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            <span className="font-medium text-foreground">{formatCurrency(ov?.totalRevenue)}</span>
            <span>total revenue</span>
          </div>
        </div>
        {revenueStats.isLoading ? (
          <ChartSkeleton h="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={revenueStats.data ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* CRM Pipeline + Ticket Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRM — contacts/leads/deals per month */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-6">CRM Pipeline (6 Months)</h2>
          {crmStats.isLoading ? (
            <ChartSkeleton h="h-56" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={crmStats.data ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="contacts" name="Contacts" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="leads" name="Leads" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="deals" name="Deals" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ticket Status Pie */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-6">Tickets by Status</h2>
          {ticketStats.isLoading ? (
            <ChartSkeleton h="h-56" />
          ) : (ticketStats.data?.byStatus?.length ?? 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
              No ticket data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie
                  data={ticketStats.data?.byStatus ?? []}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {(ticketStats.data?.byStatus ?? []).map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Deals + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top 5 Open Deals */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-lg">Top Open Deals</h2>
            <Link href="/crm" className="text-sm text-brand-500 hover:underline">View all</Link>
          </div>
          {topDeals.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (topDeals.data?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No open deals yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topDeals.data?.map((deal) => (
                <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{deal.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {deal.contact
                        ? `${deal.contact.first_name} ${deal.contact.last_name ?? ''}${deal.contact.company ? ` · ${deal.contact.company}` : ''}`
                        : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: deal.stage.color }}
                    >
                      {deal.stage.name}
                    </span>
                    <span className="font-semibold text-sm">{formatCurrency(Number(deal.value ?? 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Recent Activity</h2>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          {recentActivity.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-muted mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (recentActivity.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {recentActivity.data?.slice(0, 12).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">
                      <span className="font-medium">{entry.user?.name ?? 'System'}</span>
                      {' '}
                      <span className="text-muted-foreground">{entry.action.replace(/_/g, ' ').toLowerCase()}</span>
                      {' '}
                      <span className="font-medium">{entry.resource_type}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
