// @ts-nocheck
"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Plus,
  Search,
  Globe,
  Phone,
  Users,
  TrendingUp,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COMPANY_SIZES = [
  "SIZE_1_10",
  "SIZE_11_50",
  "SIZE_51_200",
  "SIZE_201_1000",
  "SIZE_1001_5000",
  "SIZE_5001_PLUS",
];

const SIZE_LABELS: Record<string, string> = {
  SIZE_1_10: "1–10",
  SIZE_11_50: "11–50",
  SIZE_51_200: "51–200",
  SIZE_201_1000: "201–1000",
  SIZE_1001_5000: "1001–5000",
  SIZE_5001_PLUS: "5001+",
};

function CreateAccountDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "",
    website: "",
    phone: "",
  });

  const createMutation = api.crm.accounts.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      setOpen(false);
      setForm({ name: "", domain: "", industry: "", website: "", phone: "" });
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-500 hover:bg-brand-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Company Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Corporation"
            />
          </div>
          <div>
            <Label>Domain</Label>
            <Input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="acme.com"
            />
          </div>
          <div>
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="Software"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://acme.com"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 555 000 0000"
            />
          </div>
          <Button
            className="w-full bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!form.name || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                name: form.name,
                domain: form.domain || undefined,
                industry: form.industry || undefined,
                website: form.website || undefined,
                phone: form.phone || undefined,
              })
            }
          >
            {createMutation.isPending ? "Creating..." : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPage() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");

  const { data, isLoading, refetch } = api.crm.accounts.list.useQuery({
    limit: 50,
    filters: {
      search: search || undefined,
      industry: industry && industry !== "all" ? industry : undefined,
    },
    sort: { field: "created_at", dir: "desc" },
  });

  const deleteMutation = api.crm.accounts.delete.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-500" />
            Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your company accounts and relationships
          </p>
        </div>
        <CreateAccountDialog onCreated={() => refetch()} />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            <SelectItem value="Software">Software</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
            <SelectItem value="Healthcare">Healthcare</SelectItem>
            <SelectItem value="Manufacturing">Manufacturing</SelectItem>
            <SelectItem value="Retail">Retail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {accounts.reduce((sum, a) => sum + (a._count?.contacts ?? 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {accounts.reduce((sum, a) => sum + (a._count?.deals ?? 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No accounts found</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first account to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/crm/accounts/${account.id}`}
                      className="font-medium hover:text-brand-500 flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-brand-500" />
                      </div>
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {account.domain ? (
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Globe className="w-3 h-3" />
                        {account.domain}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.industry ? (
                      <Badge variant="outline">{account.industry}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      {account._count?.contacts ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                      {account._count?.deals ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {account.owner ? (
                      <span className="text-sm">{account.owner.name}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/crm/accounts/${account.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this account?")) {
                              deleteMutation.mutate({ id: account.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
