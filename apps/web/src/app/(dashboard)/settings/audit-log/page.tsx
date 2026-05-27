"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, Filter, Loader2, Clock, User, FileText } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  view: "bg-gray-100 text-gray-600",
  export: "bg-purple-100 text-purple-700",
  import: "bg-yellow-100 text-yellow-700",
};

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key]! : "bg-muted text-muted-foreground";
}

function DiffView({ oldData, newData }: { oldData?: any; newData?: any }) {
  if (!oldData && !newData)
    return <p className="text-xs text-muted-foreground">No data recorded.</p>;

  const keys = Array.from(
    new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  );

  return (
    <div className="space-y-1">
      {keys.map((key) => {
        const before = oldData?.[key];
        const after = newData?.[key];
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        return (
          <div
            key={key}
            className={`flex gap-3 text-xs p-1.5 rounded ${changed ? "bg-yellow-50" : ""}`}
          >
            <span className="font-mono text-muted-foreground w-32 shrink-0">{key}</span>
            {before !== undefined && (
              <span className="line-through text-red-600 truncate max-w-40">
                {String(before)}
              </span>
            )}
            {changed && after !== undefined && (
              <span className="text-green-700 truncate max-w-40">{String(after)}</span>
            )}
            {!changed && before !== undefined && (
              <span className="text-foreground truncate max-w-40">{String(before)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    actor_id: "",
    entity_type: "",
    action: "",
    from: "",
    to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs, isLoading } = api.platform.auditLog.list.useQuery({
    actor_id: appliedFilters.actor_id || undefined,
    entity_type: appliedFilters.entity_type || undefined,
    action: appliedFilters.action || undefined,
    from: appliedFilters.from ? new Date(appliedFilters.from).toISOString() : undefined,
    to: appliedFilters.to ? new Date(appliedFilters.to).toISOString() : undefined,
    limit: 50,
  });

  const { data: entityTypes } = api.platform.auditLog.listEntityTypes.useQuery();
  const { data: actors } = api.platform.auditLog.listActors.useQuery();

  const handleApplyFilters = () => setAppliedFilters(filters);

  const exportCsv = () => {
    if (!logs?.length) return;
    const headers = ["Timestamp", "User", "Action", "Entity Type", "Entity ID"];
    const rows = logs.map((l: any) => [
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
      l.user?.name ?? l.user_id ?? "—",
      l.action,
      l.resource_type,
      l.resource_id ?? "—",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c: string) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Track all state-changing operations across your workspace.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!logs?.length}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-xl border border-border bg-muted/20">
        <div className="space-y-1">
          <Label className="text-xs">Action keyword</Label>
          <Input
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            placeholder="e.g. create"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Entity Type</Label>
          <Select
            value={filters.entity_type || "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, entity_type: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {entityTypes?.map((et: string) => (
                <SelectItem key={et} value={et}>
                  {et}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-end">
          <Button size="sm" className="h-8 w-full" onClick={handleApplyFilters}>
            <Filter className="w-3.5 h-3.5" />
            Apply
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{log.user?.name ?? "System"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium font-mono ${getActionColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {log.resource_type}
                      </Badge>
                      {log.resource_id && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.resource_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Clock className="w-8 h-8" />
            <p className="text-sm">No audit log entries found.</p>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{selectedLog?.action}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="font-medium">{selectedLog.user?.name ?? selectedLog.user_id ?? "System"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), "MMM dd yyyy, HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity</p>
                  <p className="font-medium">
                    {selectedLog.resource_type} — {selectedLog.resource_id ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="font-medium">{selectedLog.ip_address ?? "—"}</p>
                </div>
              </div>
              {(selectedLog.old_values ?? selectedLog.new_values) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Changes</p>
                  <div className="border border-border rounded-lg p-3 bg-muted/20">
                    <DiffView
                      oldData={selectedLog.old_values}
                      newData={selectedLog.new_values}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
