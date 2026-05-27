// @ts-nocheck
"use client";
// @ts-nocheck

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
  Users,
  TrendingUp,
  FileText,
  ArrowLeft,
  Mail,
  ExternalLink,
  Linkedin,
} from "lucide-react";

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
                {account.size && <Badge variant="secondary">{account.size.replace("SIZE_", "").replace(/_/g, " ")} employees</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {account.domain && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <a href={`https://${account.domain}`} target="_blank" className="text-brand-500 hover:underline flex items-center gap-1">
                {account.domain} <ExternalLink className="w-3 h-3" />
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
          {account.linkedin_url && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              <a href={account.linkedin_url} target="_blank" className="text-brand-500 hover:underline">LinkedIn</a>
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
                <p className="text-2xl font-bold">{account.contacts?.length ?? 0}</p>
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
                <p className="text-2xl font-bold">{account.deals?.length ?? 0}</p>
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
                <p className="text-2xl font-bold">
                  {formatCurrency(account.deals?.reduce((sum, d) => sum + Number(d.amount ?? 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Deal Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts ({account.contacts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="deals">
            Deals ({account.deals?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {account.contacts && account.contacts.length > 0 ? (
              <div className="divide-y divide-border">
                {account.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center text-sm font-semibold text-brand-500">
                        {contact.first_name[0]}{contact.last_name?.[0] ?? ""}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {contact.first_name} {contact.last_name ?? ""}
                        </p>
                        {contact.job_title && (
                          <p className="text-xs text-muted-foreground">{contact.job_title}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-foreground">
                        <Mail className="w-4 h-4" />
                      </a>
                      <Badge variant="outline" className="text-xs capitalize">
                        {contact.lifecycle_stage}
                      </Badge>
                      <Link href={`/crm/contacts/${contact.id}`} className="text-brand-500 text-xs hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No contacts yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {account.deals && account.deals.length > 0 ? (
              <div className="divide-y divide-border">
                {account.deals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{deal.name}</p>
                      {deal.stage && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {deal.amount && (
                        <span className="font-semibold text-sm">{formatCurrency(Number(deal.amount))}</span>
                      )}
                      <Link href={`/crm/deals/${deal.id}`} className="text-brand-500 text-xs hover:underline">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No deals yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {account.notes && account.notes.length > 0 ? (
              <div className="divide-y divide-border">
                {account.notes.map((note) => (
                  <div key={note.id} className="p-4">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.created_at).toLocaleDateString()}
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

        <TabsContent value="hierarchy" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6">
            {account.parent_account && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Parent Account</p>
                <Link
                  href={`/crm/accounts/${account.parent_account.id}`}
                  className="flex items-center gap-2 text-brand-500 hover:underline"
                >
                  <Building2 className="w-4 h-4" />
                  {account.parent_account.name}
                </Link>
              </div>
            )}
            {account.child_accounts && account.child_accounts.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Child Accounts ({account.child_accounts.length})
                </p>
                <div className="space-y-2">
                  {account.child_accounts.map((child) => (
                    <Link
                      key={child.id}
                      href={`/crm/accounts/${child.id}`}
                      className="flex items-center gap-2 text-brand-500 hover:underline"
                    >
                      <Building2 className="w-4 h-4" />
                      {child.name}
                      {child.domain && <span className="text-muted-foreground text-xs">({child.domain})</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!account.parent_account && (!account.child_accounts || account.child_accounts.length === 0) && (
              <p className="text-sm text-muted-foreground">No hierarchy relationships</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
