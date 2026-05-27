'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/trpc/react';
import { cn, formatCurrency, getInitials, generateAvatarColor, timeAgo } from '@/lib/utils';
import {
  Users, Target, TrendingUp, DollarSign, Plus,
  Phone, Mail, CalendarCheck, Mic2, FileText,
  Activity, ArrowUpRight, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const activityTypeIcon: Record<string, React.ElementType> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: CalendarCheck,
  DEMO: Mic2,
  NOTE: FileText,
  TASK: CheckCircle2,
  FOLLOW_UP: Activity,
};

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  const bg =
    color === 'brand' ? 'bg-brand-500/10' :
    color === 'violet' ? 'bg-violet-500/10' :
    color === 'cyan' ? 'bg-cyan-500/10' : 'bg-green-500/10';
  const text =
    color === 'brand' ? 'text-brand-500' :
    color === 'violet' ? 'text-violet-500' :
    color === 'cyan' ? 'text-cyan-500' : 'text-green-500';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-brand-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-5 h-5 ${text}`} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-sm mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function CRMDashboardPage() {
  const { data: stats, isLoading } = api.crm.stats.useQuery();
  const pathname = usePathname();

  const subNavLinks = [
    { href: '/crm', label: 'Overview', exact: true },
    { href: '/crm/contacts', label: 'Contacts' },
    { href: '/crm/leads', label: 'Leads' },
    { href: '/crm/deals', label: 'Deals' },
    { href: '/crm/activities', label: 'Activities' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Manage your contacts, leads, and deals</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/crm/leads"
            className="flex items-center gap-1.5 border border-border hover:border-brand-500/50 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Target className="w-4 h-4" /> Add Lead
          </Link>
          <Link
            href="/crm/contacts"
            className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </Link>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-border">
        {subNavLinks.map((link) => {
          const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted mb-4" />
              <div className="h-7 w-24 bg-muted rounded mb-2" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Contacts" value={stats?.totalContacts ?? 0} icon={Users} color="brand" />
          <StatCard label="Active Leads" value={stats?.activeLeads ?? 0} icon={Target} color="violet" />
          <StatCard
            label="Open Deals"
            value={formatCurrency(stats?.totalDealValue ?? 0)}
            sub={`${stats?.openDealsCount ?? 0} deals`}
            icon={TrendingUp}
            color="cyan"
          />
          <StatCard
            label="Won This Month"
            value={formatCurrency(stats?.wonValueThisMonth ?? 0)}
            sub={`${stats?.wonDealsThisMonth ?? 0} deals closed`}
            icon={DollarSign}
            color="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline funnel chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Pipeline Overview</h2>
            <Link href="/crm/deals" className="text-sm text-brand-500 hover:underline">View deals</Link>
          </div>
          {isLoading ? (
            <div className="h-48 bg-muted rounded-xl animate-pulse" />
          ) : stats?.pipelineStages && stats.pipelineStages.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.pipelineStages} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'value' ? formatCurrency(value) : value,
                    name === 'value' ? 'Value' : 'Deals',
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats.pipelineStages.map((entry, index) => (
                    <Cell key={index} fill={entry.color || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No pipeline data yet</p>
              <Link href="/crm/deals" className="text-brand-500 text-sm mt-1 hover:underline">Create a deal</Link>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Recent Activities</h2>
            <Link href="/crm/activities" className="text-sm text-brand-500 hover:underline">View all</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-36 bg-muted rounded mb-1" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentActivities && stats.recentActivities.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivities.map((activity) => {
                const Icon = activityTypeIcon[activity.type] ?? Activity;
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.contact
                          ? `${activity.contact.first_name} ${activity.contact.last_name ?? ''} • `
                          : ''}
                        {timeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activities yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/crm/contacts', label: 'Add Contact', icon: Users, color: 'brand' },
          { href: '/crm/leads', label: 'Add Lead', icon: Target, color: 'violet' },
          { href: '/crm/deals', label: 'Add Deal', icon: TrendingUp, color: 'cyan' },
          { href: '/crm/activities', label: 'Log Activity', icon: Activity, color: 'green' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-muted group-hover:bg-brand-500/10 flex items-center justify-center transition-colors flex-shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
