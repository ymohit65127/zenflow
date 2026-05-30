"use client";

import { use } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Globe,
  Phone,
  TrendingUp,
  ArrowLeft,
  Mail,
  ExternalLink,
  Users,
} from "lucide-react";

function safeLinkHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  return undefined;
}

function formatCurrency(amount: number | null | undefined) {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: account, isLoading } = api.crm.accounts.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Account not found</p>
        <Link href="/crm/accounts" className="text-brand-500 mt-2 block">Back to accounts</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/crm/accounts" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Accounts
      </Link>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {account.industry && <Badge variant="outline">{account.industry}</Badge>}
                {account.company_size && <Badge variant="secondary">{String(account.company_size).replace("SIZE_", "").replace(/_/g, " ")} employees</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {account.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <a href={safeLinkHref(account.website)} target="_blank" className="text-brand-500 hover:underline flex items-center gap-1">
                {account.website} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {account.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{account.phone}</span>
            </div>
          )}
          {account.annual_revenue && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span>ARR: {formatCurrency(Number(account.annual_revenue))}</span>
            </div>
          )}
          {account.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${account.email}`} className="text-brand-500 hover:underline">{account.email}</a>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-500" />
              <div>
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-500" />
              <div>
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">Deal Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-3 text-sm">
            {account.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{account.description}</p>
              </div>
            )}
            {account.tags && account.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {account.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {!account.description && (!account.tags || account.tags.length === 0) && (
              <p className="text-muted-foreground">No additional details</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6">
            {account.parent && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Parent Account</p>
                <Link
                  href={`/crm/accounts/${account.parent.id}`}
                  className="flex items-center gap-2 text-brand-500 hover:underline"
                >
                  <Building2 className="w-4 h-4" />
                  {account.parent.name}
                </Link>
              </div>
            )}
            {account.children && account.children.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Child Accounts ({account.children.length})
                </p>
                <div className="space-y-2">
                  {account.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/crm/accounts/${child.id}`}
                      className="flex items-center gap-2 text-brand-500 hover:underline"
                    >
                      <Building2 className="w-4 h-4" />
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!account.parent && (!account.children || account.children.length === 0) && (
              <p className="text-sm text-muted-foreground">No hierarchy relationships</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
