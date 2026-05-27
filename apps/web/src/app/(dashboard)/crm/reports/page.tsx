"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart2,
  TrendingUp,
  Target,
  Users,
  DollarSign,
  Trophy,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

function formatCurrency(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function getDateRange(period: string): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return { dateFrom, dateTo: now };
}

export default function ReportsPage() {
  const [selectedPipeline, setSelectedPipeline] = useState("all");
  const [forecastPeriod, setForecastPeriod] = useState<"this_month" | "next_month" | "this_quarter">("this_month");

  const { data: pipelines } = api.crm.pipelines.list.useQuery();
  const firstPipelineId = pipelines?.[0]?.id;

  const { dateFrom, dateTo } = getDateRange("3months");

  const { data: summary } = api.crm.reports.getPipelineSummary.useQuery(
    {
      pipelineId: selectedPipeline !== "all" ? selectedPipeline : undefined,
      dateFrom,
      dateTo,
    },
    { enabled: true }
  );

  const { data: winLoss } = api.crm.reports.getWinLossAnalysis.useQuery(
    { dateFrom, dateTo, groupBy: "owner" },
    { enabled: true }
  );

  const { data: forecast } = api.crm.reports.getForecast.useQuery(
    {
      pipelineId: (selectedPipeline !== "all" ? selectedPipeline : firstPipelineId) ?? "",
      period: forecastPeriod,
    },
    { enabled: !!(selectedPipeline !== "all" ? selectedPipeline : firstPipelineId) }
  );

  const { data: leaderboard } = api.crm.reports.getLeaderboard.useQuery(
    { metric: "revenue", dateFrom, dateTo },
    { enabled: true }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-500" />
            CRM Reports
          </h1>
          <p className="text-muted-foreground mt-1">Pipeline analytics and performance metrics</p>
        </div>
        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pipelines</SelectItem>
            {pipelines?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                <span className="text-xs text-muted-foreground">Total Deals</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalDeals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Total Value</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-muted-foreground">Avg Deal Size</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.avgDealSize)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Win Rate</span>
              </div>
              <p className="text-2xl font-bold">{(summary.conversionRate * 100).toFixed(0)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by stage */}
        {summary && summary.byStage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.byStage} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "value" ? formatCurrency(value) : value,
                      name === "value" ? "Value" : "Count",
                    ]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {summary.byStage.map((entry, index) => (
                      <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Win/Loss Analysis */}
        {winLoss && winLoss.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Win/Loss by Rep</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={winLoss.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="won" name="Won" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={12} />
                  <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Forecast */}
      {(selectedPipeline !== "all" || firstPipelineId) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline Forecast</CardTitle>
              <Select value={forecastPeriod} onValueChange={(v) => setForecastPeriod(v as typeof forecastPeriod)}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="next_month">Next Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {forecast ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Best Case</p>
                    <p className="text-xl font-bold text-green-500">{formatCurrency(forecast.bestCase)}</p>
                  </div>
                  <div className="bg-brand-500/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Weighted</p>
                    <p className="text-xl font-bold text-brand-500">{formatCurrency(forecast.weighted)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Commit</p>
                    <p className="text-xl font-bold">{formatCurrency(forecast.commit)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {forecast.dealCount} deals closing in period · Avg: {formatCurrency(forecast.avgDealSize)} ·
                  Historical win rate: {(forecast.historicalWinRate * 100).toFixed(0)}%
                </p>

                {forecast.closingDeals.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closing Deals</p>
                    {forecast.closingDeals.slice(0, 5).map((deal) => (
                      <div key={deal.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                        <span className="truncate flex-1 mr-4">{deal.name}</span>
                        <Badge variant="outline" className="text-xs mr-3">{deal.stageName}</Badge>
                        <span className="text-xs text-muted-foreground mr-3">{deal.probability}%</span>
                        <span className="font-semibold">{formatCurrency(deal.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a pipeline to see forecast</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {leaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Sales Leaderboard (Revenue Won)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.map((rep, idx) => (
                <div key={rep.userId} className="flex items-center gap-4">
                  <span className={`w-6 text-center font-bold text-sm ${idx === 0 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-semibold text-brand-500 flex-shrink-0">
                    {rep.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rep.name}</p>
                    <p className="text-xs text-muted-foreground">{rep.dealsWon} deals won</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(rep.revenue)}</p>
                    <p className="text-xs text-muted-foreground">avg {formatCurrency(rep.avgDealSize)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
