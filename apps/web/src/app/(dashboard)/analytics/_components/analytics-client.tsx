'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  Users, DollarSign, Kanban, Headphones, TrendingUp,
  BarChart3, PieChartIcon, CheckCircle2, ArrowUpRight,
  ArrowDownRight, Trophy, Target,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

type DateRange = 'week' | 'month' | 'quarter' | 'year';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: 'quarter' },
  { label: 'This Year', value: 'year' },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, sub, color = 'brand',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  color?: 'brand' | 'violet' | 'cyan' | 'green' | 'amber';
}) {
  const colorMap = {
    brand: { bg: 'bg-brand-500/10', text: 'text-brand-500' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} mb-4`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ChartSkeleton({ h = 'h-56' }: { h?: string }) {
  return <div className={`${h} bg-muted rounded-xl animate-pulse`} />;
}

export function AnalyticsClient() {
  const [dateRange, setDateRange] = useState<DateRange>('month');

  const overview = api.analytics.overview.useQuery();
  const crmStats = api.analytics.crmStats.useQuery();
  const revenueStats = api.analytics.revenueStats.useQuery();
  const ticketStats = api.analytics.ticketStats.useQuery();
  const projectStats = api.analytics.projectStats.useQuery();
  const leadsBySource = api.analytics.leadsBySource.useQuery();
  const dealsWonLost = api.analytics.dealsWonLost.useQuery();
  const invoiceStats = api.analytics.invoiceStats.useQuery();

  const ov = overview.data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Data-driven insights across your entire workspace
          </p>
        </div>
        {/* Date range filter */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                dateRange === opt.value
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview grid */}
      <div>
        <SectionHeader title="Overview" subtitle="Key metrics across all modules" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Users" value={formatNumber(ov?.totalUsers)} icon={Users} color="brand" sub={`${ov?.activeUsers ?? 0} active`} />
          <StatCard label="Total Contacts" value={formatNumber(ov?.totalContacts)} icon={Users} color="violet" sub={`+${ov?.newContactsThisMonth ?? 0} this month`} />
          <StatCard label="Open Deals" value={formatCurrency(ov?.totalDealValue)} icon={DollarSign} color="cyan" sub={`${ov?.openDeals ?? 0} deals`} />
          <StatCard label="Active Projects" value={formatNumber(ov?.activeProjects)} icon={Kanban} color="green" sub={`${ov?.completedTasksThisWeek ?? 0} tasks/week`} />
          <StatCard label="Open Tickets" value={formatNumber(ov?.openTickets)} icon={Headphones} color="amber" sub={`${ov?.resolvedTicketsThisMonth ?? 0} resolved`} />
          <StatCard label="Total Revenue" value={formatCurrency(ov?.totalRevenue)} icon={TrendingUp} color="brand" sub={`${formatCurrency(ov?.outstandingInvoices)} outstanding`} />
        </div>
      </div>

      {/* CRM Performance */}
      <div>
        <SectionHeader title="CRM Performance" subtitle="Contact acquisition, lead sources and deal performance" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Contacts per month — Line Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-brand-500" />
              <h3 className="font-medium">New Contacts per Month</h3>
            </div>
            {crmStats.isLoading ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={crmStats.data ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="contacts" stroke="#6366f1" strokeWidth={2} dot={false} name="Contacts" />
                  <Line type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Leads" />
                  <Line type="monotone" dataKey="deals" stroke="#06b6d4" strokeWidth={2} dot={false} name="Deals" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Leads by Source — Pie */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-violet-500" />
              <h3 className="font-medium">Leads by Source</h3>
            </div>
            {leadsBySource.isLoading ? <ChartSkeleton /> : (leadsBySource.data?.length ?? 0) === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={leadsBySource.data ?? []} cx="50%" cy="42%" outerRadius={70} dataKey="count" nameKey="source" paddingAngle={2}>
                    {(leadsBySource.data ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace(/_/g, ' ')} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Deals Won vs Lost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {dealsWonLost.data && (
            <>
              <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{dealsWonLost.data.won.count}</p>
                  <p className="text-sm font-medium">Deals Won This Quarter</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(dealsWonLost.data.won.value)} total value</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-green-500 ml-auto" />
              </div>
              <div className="bg-card border border-red-500/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <ArrowDownRight className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{dealsWonLost.data.lost.count}</p>
                  <p className="text-sm font-medium">Deals Lost This Quarter</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(dealsWonLost.data.lost.value)} total value</p>
                </div>
                <ArrowDownRight className="w-5 h-5 text-red-400 ml-auto" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Project Performance */}
      <div>
        <SectionHeader title="Project Performance" subtitle="Task velocity and project health" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks completed this vs last week */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-cyan-500" />
              <h3 className="font-medium">Task Completion</h3>
            </div>
            {projectStats.isLoading ? <ChartSkeleton h="h-40" /> : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">This week</span>
                  <span className="font-bold text-2xl text-cyan-600">{projectStats.data?.thisWeekDone ?? 0}</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((projectStats.data?.thisWeekDone ?? 0) / Math.max(1, (projectStats.data?.thisWeekDone ?? 0) + (projectStats.data?.lastWeekDone ?? 0))) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last week</span>
                  <span className="font-semibold">{projectStats.data?.lastWeekDone ?? 0}</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/30 transition-all"
                    style={{
                      width: `${Math.min(100, ((projectStats.data?.lastWeekDone ?? 0) / Math.max(1, (projectStats.data?.thisWeekDone ?? 0) + (projectStats.data?.lastWeekDone ?? 0))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Projects by status — Donut */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Kanban className="w-4 h-4 text-brand-500" />
              <h3 className="font-medium">Projects by Status</h3>
            </div>
            {projectStats.isLoading ? <ChartSkeleton h="h-40" /> : (projectStats.data?.projectsByStatus?.length ?? 0) === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No projects yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={projectStats.data?.projectsByStatus ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {(projectStats.data?.projectsByStatus ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Analytics */}
      <div>
        <SectionHeader title="Revenue Analytics" subtitle="Monthly revenue trends and invoice breakdown" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Bar Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-brand-500" />
              <h3 className="font-medium">Monthly Revenue</h3>
            </div>
            {revenueStats.isLoading ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueStats.data ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Invoice Status Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-violet-500" />
              <h3 className="font-medium">Invoice Status</h3>
            </div>
            {invoiceStats.isLoading ? <ChartSkeleton /> : (invoiceStats.data?.length ?? 0) === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No invoices yet</div>
            ) : (
              <div className="space-y-2 mt-2">
                {invoiceStats.data?.map((item) => (
                  <div key={item.status} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm">{item.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{item.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">({formatCurrency(item.total)})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Desk Performance */}
      <div>
        <SectionHeader title="Help Desk Performance" subtitle="Ticket volume and resolution metrics" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Headphones className="w-4 h-4 text-amber-500" />
              <h3 className="font-medium">Tickets by Status</h3>
            </div>
            {ticketStats.isLoading ? <ChartSkeleton /> : (ticketStats.data?.byStatus?.length ?? 0) === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No tickets yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ticketStats.data?.byStatus ?? []} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                    {(ticketStats.data?.byStatus ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Headphones className="w-4 h-4 text-red-500" />
              <h3 className="font-medium">Tickets by Priority</h3>
            </div>
            {ticketStats.isLoading ? <ChartSkeleton /> : (ticketStats.data?.byPriority?.length ?? 0) === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No tickets yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ticketStats.data?.byPriority ?? []}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {(ticketStats.data?.byPriority ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
