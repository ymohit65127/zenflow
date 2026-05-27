// @ts-nocheck
"use client";
// @ts-nocheck

import { use } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  AlertTriangle,
  Trophy,
  FileText,
  Package,
  Clock,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(val: number | null | undefined) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: deal, isLoading, refetch } = api.crm.dealsV2.getById.useQuery({ id });
  const { data: timeline } = api.crm.dealsV2.getTimeline.useQuery({ dealId: id });

  const markWonMutation = api.crm.dealsV2.markWon.useMutation({
    onSuccess: () => { toast.success("Deal marked as won!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const markLostMutation = api.crm.dealsV2.markLost.useMutation({
    onSuccess: () => { toast.success("Deal marked as lost"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Deal not found</p>
        <Link href="/crm/deals" className="text-brand-500 mt-2 block">Back to deals</Link>
      </div>
    );
  }

  const probability = Number(deal.probability ?? deal.stage?.probability ?? 0);
  const isWon = !!deal.won_at;
  const isLost = !!deal.lost_at;

  return (
    <div className="space-y-6">
      <Link href="/crm/deals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isWon ? "bg-green-500/10" : isLost ? "bg-red-500/10" : "bg-brand-500/10"}`}>
              {isWon ? (
                <Trophy className="w-6 h-6 text-green-500" />
              ) : isLost ? (
                <TrendingUp className="w-6 h-6 text-red-500" />
              ) : (
                <TrendingUp className="w-6 h-6 text-brand-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{deal.name}</h1>
                {deal.rotting && !isWon && !isLost && (
                  <Badge className="bg-orange-500/10 text-orange-600 border-orange-300">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Rotting
                  </Badge>
                )}
                {isWon && <Badge className="bg-green-500/10 text-green-600 border-green-300">Won</Badge>}
                {isLost && <Badge className="bg-red-500/10 text-red-600 border-red-300">Lost</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {deal.pipeline && <span className="text-sm text-muted-foreground">{deal.pipeline.name}</span>}
                {deal.stage && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color }}
                  >
                    {deal.stage.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!isWon && !isLost && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => markLostMutation.mutate({ dealId: deal.id })}
              >
                Mark Lost
              </Button>
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => markWonMutation.mutate({ dealId: deal.id })}
              >
                <Trophy className="w-3.5 h-3.5 mr-1" /> Mark Won
              </Button>
            </div>
          )}
        </div>

        {/* Stage progress */}
        {deal.pipeline?.stages && !isWon && !isLost && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Stage Progress</span>
              <span>{probability}% probability</span>
            </div>
            <div className="flex gap-1">
              {deal.pipeline.stages.filter((s) => s.stage_type === "active").map((stage) => (
                <div
                  key={stage.id}
                  className="h-2 flex-1 rounded-full transition-all"
                  style={{
                    backgroundColor: deal.stage_id === stage.id
                      ? stage.color
                      : deal.pipeline!.stages.findIndex((s) => s.id === stage.id) <
                          deal.pipeline!.stages.findIndex((s) => s.id === deal.stage_id)
                        ? `${stage.color}40`
                        : "hsl(var(--muted))",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="font-semibold">{formatCurrency(Number(deal.amount ?? 0))}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Close Date</p>
              <p className="font-semibold">{formatDate(deal.expected_close_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="font-semibold">{deal.owner?.name ?? "Unassigned"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Weighted</p>
              <p className="font-semibold">
                {deal.weighted_amount ? formatCurrency(Number(deal.weighted_amount)) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products ({deal.products?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({deal.quotes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes ({deal.notes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-medium text-sm">Deal Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{deal.deal_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="capitalize">{deal.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span>{deal.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span>{deal.source ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(deal.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-medium text-sm">Related</h3>
                <div className="space-y-2 text-sm">
                  {deal.contact && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact</span>
                      <Link href={`/crm/contacts/${deal.contact.id}`} className="text-brand-500 hover:underline">
                        {deal.contact.first_name} {deal.contact.last_name ?? ""}
                      </Link>
                    </div>
                  )}
                  {deal.account && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account</span>
                      <Link href={`/crm/accounts/${deal.account.id}`} className="text-brand-500 hover:underline">
                        {deal.account.name}
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {deal.description && (
              <Card className="md:col-span-2">
                <CardContent className="pt-4">
                  <h3 className="font-medium text-sm mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {deal.products && deal.products.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Unit Price</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.products.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </td>
                      <td className="p-3 text-right">{Number(item.quantity)}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(Number(item.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No products added</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {deal.quotes && deal.quotes.length > 0 ? (
              <div className="divide-y divide-border">
                {deal.quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{quote.title}</p>
                      <p className="text-xs text-muted-foreground">{quote.number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          quote.status === "accepted"
                            ? "text-green-600 border-green-300"
                            : quote.status === "rejected"
                            ? "text-red-600 border-red-300"
                            : quote.status === "sent"
                            ? "text-blue-600 border-blue-300"
                            : ""
                        }
                      >
                        {quote.status}
                      </Badge>
                      <span className="font-semibold text-sm">{formatCurrency(Number(quote.grand_total))}</span>
                      <Link href={`/crm/quotes/${quote.id}`} className="text-brand-500 text-xs hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No quotes yet</p>
                <Link href={`/crm/quotes?dealId=${deal.id}`} className="text-brand-500 text-xs mt-1 block hover:underline">
                  Create a quote
                </Link>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-3">
            {timeline && timeline.length > 0 ? (
              timeline.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.type === "activity" && <Activity className="w-3.5 h-3.5 text-muted-foreground" />}
                    {item.type === "note" && <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                    {item.type === "email" && <Activity className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 bg-card border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                    {item.type === "note" && (
                      <p className="text-sm mt-1">{(item.data as { content: string }).content}</p>
                    )}
                    {item.type === "activity" && (
                      <p className="text-sm mt-1">{(item.data as { title: string }).title}</p>
                    )}
                    {item.type === "email" && (
                      <p className="text-sm mt-1">{(item.data as { subject?: string }).subject ?? "(No subject)"}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No timeline activity yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {deal.notes && deal.notes.length > 0 ? (
              <div className="divide-y divide-border">
                {deal.notes.map((note) => (
                  <div key={note.id} className="p-4">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
