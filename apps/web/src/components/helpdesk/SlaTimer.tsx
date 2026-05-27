'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlaStatus = 'OK' | 'WARNING' | 'BREACHED';

interface SlaTimerProps {
  dueAt: Date | string | null | undefined;
  completedAt?: Date | string | null;
  label?: string;
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function getStatus(dueAt: Date, completedAt?: Date | null): { status: SlaStatus; msRemaining: number } {
  const now = new Date();

  if (completedAt) {
    const onTime = completedAt <= dueAt;
    return { status: onTime ? 'OK' : 'BREACHED', msRemaining: 0 };
  }

  const msRemaining = dueAt.getTime() - now.getTime();
  const totalMs = dueAt.getTime(); // can't know total without start, use a heuristic
  if (msRemaining < 0) return { status: 'BREACHED', msRemaining };
  if (msRemaining < 30 * 60000) return { status: 'WARNING', msRemaining }; // <30 min
  return { status: 'OK', msRemaining };
}

const STATUS_CONFIG: Record<SlaStatus, { label: string; icon: React.ElementType; badgeClass: string; textClass: string }> = {
  OK: {
    label: 'On Track',
    icon: CheckCircle,
    badgeClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    textClass: 'text-green-600 dark:text-green-400',
  },
  WARNING: {
    label: 'Due Soon',
    icon: AlertTriangle,
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  BREACHED: {
    label: 'Breached',
    icon: XCircle,
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    textClass: 'text-red-600 dark:text-red-400',
  },
};

// ---------------------------------------------------------------------------
// SlaTimer Component
// ---------------------------------------------------------------------------

export function SlaTimer({ dueAt, completedAt, label, compact = false, className }: SlaTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!dueAt || completedAt) return;
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, [dueAt, completedAt]);

  if (!dueAt) return null;

  const dueDateObj = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const completedDateObj = completedAt
    ? completedAt instanceof Date ? completedAt : new Date(completedAt)
    : null;

  const { status, msRemaining } = getStatus(dueDateObj, completedDateObj);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
          config.badgeClass,
          className,
        )}
        title={label ?? 'SLA Timer'}
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        {completedAt
          ? status === 'OK' ? 'Met' : 'Missed'
          : status === 'BREACHED'
            ? `+${formatDuration(Math.abs(msRemaining))} overdue`
            : formatDuration(msRemaining)}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium', config.badgeClass)}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-semibold">
          {completedAt
            ? status === 'OK' ? 'SLA Met' : 'SLA Missed'
            : status === 'BREACHED'
              ? `Overdue by ${formatDuration(Math.abs(msRemaining))}`
              : `${formatDuration(msRemaining)} remaining`}
        </span>
        {label && <span className="opacity-70">· {label}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlaStatusBadge (simpler, for list views)
// ---------------------------------------------------------------------------

interface SlaStatusBadgeProps {
  slaStatus: string;
  className?: string;
}

export function SlaStatusBadge({ slaStatus, className }: SlaStatusBadgeProps) {
  const configs: Record<string, { label: string; cls: string }> = {
    ok: { label: 'SLA OK', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    warning: { label: 'Due Soon', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    breached_first: { label: 'FRT Breached', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    breached_resolution: { label: 'Resolution Breached', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  const config = configs[slaStatus] ?? configs['ok']!;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.cls, className)}>
      <Clock className="w-3 h-3" />
      {config.label}
    </span>
  );
}
