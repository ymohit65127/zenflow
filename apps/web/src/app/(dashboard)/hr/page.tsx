'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, UserCheck, UserX, UserPlus, Plus, ArrowUpRight, Building2, CalendarDays, Clock } from 'lucide-react';
import { api } from '@/trpc/react';
import { cn, getInitials, generateAvatarColor, formatDate } from '@/lib/utils';

const tabs = ['Employees', 'Leave Requests', 'Attendance', 'Departments'] as const;
type Tab = (typeof tabs)[number];

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INACTIVE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TERMINATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const leaveStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2 mb-3" />
      <div className="h-8 bg-muted rounded w-1/3 mb-1" />
      <div className="h-3 bg-muted rounded w-2/3" />
    </div>
  );
}

function EmployeeRow({ emp }: { emp: Parameters<typeof EmployeesTab>[0]['employees'][0] }) {
  const name = `${emp.first_name} ${emp.last_name}`;
  const color = generateAvatarColor(name);
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {getInitials(name)}
          </div>
          <div>
            <p className="font-medium text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{emp.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.employee_code}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department?.name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.designation ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[emp.status] ?? '')}>
          {emp.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(emp.join_date)}</td>
      <td className="px-4 py-3">
        <Link
          href={`/hr/employees`}
          className="text-xs text-brand-500 hover:underline"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

type EmployeeItem = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string;
  designation: string | null;
  status: string;
  join_date: Date;
  department: { id: string; name: string } | null;
};

function EmployeesTab({ employees, isLoading }: { employees: EmployeeItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  if (employees.length === 0) {
    return (
      <div className="p-12 text-center">
        <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="font-medium text-muted-foreground">No employees yet</p>
        <p className="text-sm text-muted-foreground mt-1">Add your first employee to get started</p>
        <Link href="/hr/employees" className="inline-flex items-center gap-1.5 mt-4 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Employee
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Department</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Designation</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Join Date</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <EmployeeRow key={emp.id} emp={emp} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LeaveItem = {
  id: string;
  status: string;
  from_date: Date;
  to_date: Date;
  days: unknown;
  reason: string | null;
  employee: { id: string; first_name: string; last_name: string; employee_code: string; designation: string | null };
  leave_type: { id: string; name: string; code: string; is_paid: boolean };
};

function LeaveTab({ requests, isLoading }: { requests: LeaveItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="p-12 text-center">
        <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="font-medium text-muted-foreground">No leave requests</p>
        <Link href="/hr/leave" className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-500 hover:underline">
          Manage Leave
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Leave Type</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Duration</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">
                {r.employee.first_name} {r.employee.last_name}
                <span className="ml-1 text-xs text-muted-foreground">({r.employee.employee_code})</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.leave_type.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(r.from_date)} — {formatDate(r.to_date)}
                <span className="ml-1 text-xs">({String(r.days)}d)</span>
              </td>
              <td className="px-4 py-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', leaveStatusColors[r.status] ?? '')}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AttendanceItem = {
  id: string;
  status: string;
  date: Date;
  check_in: Date | null;
  check_out: Date | null;
  hours_worked: unknown;
  employee: { id: string; first_name: string; last_name: string; employee_code: string; designation: string | null };
};

const attendanceColors: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HALF_DAY: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HOLIDAY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WEEKEND: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function AttendanceTab({ records, isLoading }: { records: AttendanceItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="p-12 text-center">
        <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="font-medium text-muted-foreground">No attendance records</p>
        <Link href="/hr/attendance" className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-500 hover:underline">
          Mark Attendance
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Check In</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Check Out</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Hours</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">
                {r.employee.first_name} {r.employee.last_name}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.check_in ? formatDate(r.check_in, 'HH:mm') : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.check_out ? formatDate(r.check_out, 'HH:mm') : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.hours_worked ? `${String(r.hours_worked)}h` : '—'}</td>
              <td className="px-4 py-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', attendanceColors[r.status] ?? '')}>
                  {r.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DepartmentItem = {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
  children: { id: string; name: string }[];
};

function DepartmentsTab({ departments, isLoading }: { departments: DepartmentItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (departments.length === 0) {
    return (
      <div className="p-12 text-center">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="font-medium text-muted-foreground">No departments yet</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {departments.map((dept) => (
        <div key={dept.id} className="bg-muted/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-500" />
            </div>
            <h3 className="font-semibold">{dept.name}</h3>
          </div>
          {dept.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{dept.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{dept._count.employees}</span> employees
          </p>
        </div>
      ))}
    </div>
  );
}

export default function HRPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Employees');

  const { data: stats, isLoading: statsLoading } = api.hr.employees.stats.useQuery();
  const { data: employeesData, isLoading: empLoading } = api.hr.employees.list.useQuery({ limit: 10 });
  const { data: leaveData, isLoading: leaveLoading } = api.hr.leave.requests.useQuery({ limit: 10 });
  const { data: attendanceData, isLoading: attLoading } = api.hr.attendance.list.useQuery({ limit: 20 });
  const { data: departments, isLoading: deptLoading } = api.hr.departments.list.useQuery();

  const statCards = [
    { label: 'Total Employees', value: stats?.total ?? 0, icon: Users, color: 'text-brand-500', bg: 'bg-brand-500/10' },
    { label: 'Active', value: stats?.active ?? 0, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-500/10' },
    { label: 'On Leave', value: stats?.onLeave ?? 0, icon: UserX, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'New This Month', value: stats?.newThisMonth ?? 0, icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HR Management</h1>
          <p className="text-muted-foreground mt-1">Manage employees, leave, attendance, and departments</p>
        </div>
        <Link
          href="/hr/employees"
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsLoading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.bg)}>
                    <s.icon className={cn('w-5 h-5', s.color)} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-muted-foreground text-sm mt-0.5">{s.label}</p>
              </div>
            ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">{activeTab}</h2>
          {activeTab === 'Employees' && (
            <Link href="/hr/employees" className="text-sm text-brand-500 hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {activeTab === 'Leave Requests' && (
            <Link href="/hr/leave" className="text-sm text-brand-500 hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {activeTab === 'Attendance' && (
            <Link href="/hr/attendance" className="text-sm text-brand-500 hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {activeTab === 'Employees' && (
          <EmployeesTab employees={employeesData?.items ?? []} isLoading={empLoading} />
        )}
        {activeTab === 'Leave Requests' && (
          <LeaveTab requests={leaveData?.items ?? []} isLoading={leaveLoading} />
        )}
        {activeTab === 'Attendance' && (
          <AttendanceTab records={attendanceData?.items ?? []} isLoading={attLoading} />
        )}
        {activeTab === 'Departments' && (
          <DepartmentsTab departments={departments ?? []} isLoading={deptLoading} />
        )}
      </div>
    </div>
  );
}
