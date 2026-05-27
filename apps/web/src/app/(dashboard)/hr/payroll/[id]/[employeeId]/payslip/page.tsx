'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, User, Calendar, Printer } from 'lucide-react';
import { api } from '@/trpc/react';
import { formatDate } from '@/lib/utils';

function fmt(n: unknown) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 border-b border-border ${bold ? 'font-bold' : ''}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}

export default function PayslipPage({ params }: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id, employeeId } = use(params);

  const { data: entry, isLoading } = api.hr.hr_payroll.getPayslip.useQuery({
    period_id: id,
    employee_id: employeeId,
  });

  if (isLoading) {
    return <div className="h-96 bg-muted animate-pulse rounded-xl" />;
  }

  if (!entry) {
    return <p className="text-muted-foreground">Payslip not found.</p>;
  }

  const { employee, period } = entry;
  const emp = employee as {
    first_name: string; last_name: string; employee_code: string;
    designation_id: string | null;
  };
  const per = period as { name: string; start_date: Date; end_date: Date; payment_date: Date };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 no-print">
        <Link href={`/hr/payroll/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Payslip</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden print:border-none">
        {/* Header */}
        <div className="bg-brand-500 text-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">ZenFlow</h2>
                <p className="text-white/70 text-sm">Payslip</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">{per.name}</p>
              <p className="text-white/70 text-sm">{formatDate(per.start_date)} – {formatDate(per.end_date)}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Employee info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Employee Details</p>
              </div>
              <p className="font-bold text-lg">{emp.first_name} {emp.last_name}</p>
              <p className="text-muted-foreground text-sm">{emp.employee_code}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Payment Info</p>
              </div>
              <p className="font-medium">Payment Date</p>
              <p className="text-muted-foreground text-sm">{formatDate(per.payment_date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h3 className="font-semibold mb-3 text-green-600">Earnings</h3>
              <Row label="Basic Salary" value={fmt(entry.basic)} />
              <Row label="HRA" value={fmt(entry.hra)} />
              <Row label="Special Allowance" value={fmt(entry.special_allowance)} />
              {Number(entry.other_allowances) > 0 && <Row label="Other Allowances" value={fmt(entry.other_allowances)} />}
              <Row label="Gross Salary" value={fmt(entry.gross_salary)} bold />
            </div>

            {/* Deductions */}
            <div>
              <h3 className="font-semibold mb-3 text-red-600">Deductions</h3>
              <Row label="PF (Employee)" value={fmt(entry.pf_employee)} />
              <Row label="ESI (Employee)" value={fmt(entry.esic_employee)} />
              <Row label="Professional Tax" value={fmt(entry.pt)} />
              <Row label="TDS" value={fmt(entry.tds)} />
              {Number(entry.other_deductions) > 0 && <Row label="Other Deductions" value={fmt(entry.other_deductions)} />}
              <Row label="Total Deductions" value={fmt(entry.total_deductions)} bold />
            </div>
          </div>

          {/* Net pay */}
          <div className="mt-6 pt-4 border-t-2 border-border bg-green-50 dark:bg-green-900/10 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Net Take-Home Pay</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{fmt(entry.net_salary)}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Working Days: {entry.working_days}</p>
                <p>Paid Days: {String(entry.paid_days)}</p>
                {Number(entry.lop_days) > 0 && <p className="text-red-500">LOP: {String(entry.lop_days)}</p>}
              </div>
            </div>
          </div>

          {/* Employer contributions */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">Employer Contributions</p>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>PF: {fmt(entry.pf_employer)}</span>
              <span>ESI: {fmt(entry.esic_employer)}</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            This is a computer-generated payslip and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
}
