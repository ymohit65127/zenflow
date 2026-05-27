'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Clock, CheckCircle, Star, TrendingUp, Users } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [from] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [to] = useState(today.toISOString().slice(0, 10));

  const { data: overview } = api.helpdesk.reports.overview.useQuery({ from, to });
  const { data: volumeData } = api.helpdesk.reports.volume.useQuery({ from, to, group_by: 'day' });
  const { data: channelData } = api.helpdesk.reports.volume.useQuery({ from, to, group_by: 'channel' });
  const { data: statusData } = api.helpdesk.reports.volume.useQuery({ from, to, group_by: 'status' });
  const { data: avgFrt } = api.helpdesk.reports.avgFirstResponseTime.useQuery({ from, to });
  const { data: avgRes } = api.helpdesk.reports.avgResolutionTime.useQuery({ from, to });
  const { data: slaData } = api.helpdesk.reports.slaCompliance.useQuery({ from, to });
  const { data: csatData } = api.helpdesk.reports.csat.useQuery({ from, to });
  const { data: agentData } = api.helpdesk.reports.agentPerformance.useQuery({ from, to });

  const volumeChartData = (volumeData as { date?: string; count?: number; label?: string }[] | undefined)?.map((d) => ({
    name: d.date ?? d.label ?? '',
    tickets: d.count ?? 0,
  })) ?? [];

  const channelChartData = (channelData as { label?: string; count?: number }[] | undefined)?.map((d) => ({
    name: d.label ?? '',
    value: d.count ?? 0,
  })) ?? [];

  const slaChartData = slaData?.by_priority.filter((p) => p.total > 0).map((p) => ({
    name: p.priority,
    compliant: p.compliant,
    breached: p.total - p.compliant,
    pct: p.pct,
  })) ?? [];

  const csatTrend = csatData?.trend.map((d) => ({ name: d.date, score: d.avg })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/helpdesk" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Help Desk Reports</h1>
          <p className="text-muted-foreground mt-1">Last 30 days · {from} to {to}</p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tickets" value={overview?.total ?? 0} icon={BarChart3} color="bg-brand-500/10 text-brand-500" />
        <StatCard label="Open Tickets" value={overview?.open ?? 0} icon={Clock} color="bg-orange-500/10 text-orange-500" />
        <StatCard label="Resolved" value={overview?.resolved ?? 0} icon={CheckCircle} color="bg-green-500/10 text-green-500" />
        <StatCard label="SLA Breaches" value={overview?.sla_breached ?? 0} icon={TrendingUp} color="bg-red-500/10 text-red-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg First Response" value={`${avgFrt?.avg_hours ?? 0}h`} icon={Clock} color="bg-cyan-500/10 text-cyan-500" sub={`${avgFrt?.count ?? 0} tickets`} />
        <StatCard label="Avg Resolution Time" value={`${avgRes?.avg_hours ?? 0}h`} icon={CheckCircle} color="bg-violet-500/10 text-violet-500" sub={`${avgRes?.count ?? 0} tickets`} />
        <StatCard label="SLA Compliance" value={`${slaData?.compliance_pct ?? 0}%`} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-500" sub={`${slaData?.compliant ?? 0} / ${slaData?.total ?? 0}`} />
        <StatCard label="CSAT Score" value={csatData?.avg_score ? `${csatData.avg_score}/10` : '—'} icon={Star} color="bg-yellow-500/10 text-yellow-500" sub={`${csatData?.response_rate_pct ?? 0}% response rate`} />
      </div>

      {/* Volume chart */}
      {volumeChartData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold mb-5">Ticket Volume (Daily)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={volumeChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="tickets" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel distribution */}
        {channelChartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold mb-5">Tickets by Channel</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={channelChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}>
                  {channelChartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* SLA compliance by priority */}
        {slaChartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold mb-5">SLA Compliance by Priority</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={slaChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="compliant" fill="#22c55e" name="Compliant" radius={[2, 2, 0, 0]} />
                <Bar dataKey="breached" fill="#ef4444" name="Breached" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* CSAT Trend */}
      {csatTrend.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold mb-5">CSAT Score Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={csatTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Agent Performance */}
      {(agentData?.length ?? 0) > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Agent Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Resolved</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Avg Resolution</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Avg FRT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">CSAT</th>
                </tr>
              </thead>
              <tbody>
                {agentData?.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{agent.agent_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{agent.assigned_count}</td>
                    <td className="px-4 py-3">{agent.resolved_count}</td>
                    <td className="px-4 py-3">{agent.avg_resolution_hours}h</td>
                    <td className="px-4 py-3">{agent.avg_response_hours}h</td>
                    <td className="px-4 py-3">{agent.avg_csat ? `${agent.avg_csat}/10` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
