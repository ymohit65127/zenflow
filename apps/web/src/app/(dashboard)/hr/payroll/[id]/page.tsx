'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, DollarSign, Download } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  computed: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

function fmt(n: unknown) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: period, isLoading: periodLoading } = api.hr.hr_payroll.getPeriod.useQuery({ id });
  const { data, isLoading } = api.hr.hr_payroll.listEntries.useQuery({ period_id: id, page, search, limit: 50 });

  const entries = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  if (periodLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!period) {
    return <p className="text-muted-foreground">Period not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{period.name}</h1>
          <p className="text-muted-foreground mt-0.5 capitalize">{period.status} · {period.employee_count ?? 0} employees</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Gross', value: fmt(period.total_gross ?? 0), color: 'text-blue-600' },
          { label: 'Total Deductions', value: fmt(period.total_deductions ?? 0), color: 'text-red-600' },
          { label: 'Total Net', value: fmt(period.total_net ?? 0), color: 'text-green-600' },
          { label: 'Employees', value: String(period.employee_count ?? 0), color: 'text-brand-500' },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn('text-xl font-bold mt-1', c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search employees..."
          className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {/* Entries table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Employee Payslips <span className="text-muted-foreground font-normal text-sm">({total})</span></h2>
          <button className="flex items-center gap-1.5 text-sm text-brand-500 hover:underline">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No payroll entries. Run payroll computation first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Basic</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">HRA</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Gross</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">PF</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">TDS</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Deductions</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Net</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium">{e.employee.first_name} {e.employee.last_name}</p>
                      <p className="text-xs text-muted-foreground">{e.employee.employee_code}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs">{fmt(e.basic)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs">{fmt(e.hra)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold">{fmt(e.gross_salary)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-red-600">{fmt(e.pf_employee)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-red-600">{fmt(e.tds)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-red-600">{fmt(e.total_deductions)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-bold text-green-600">{fmt(e.net_salary)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[e.status] ?? '')}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/hr/payroll/${id}/${e.employee.id}/payslip`}
                        className="text-xs text-brand-500 hover:underline whitespace-nowrap"
                      >
                        View Payslip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-border rounded-lg text-sm disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
