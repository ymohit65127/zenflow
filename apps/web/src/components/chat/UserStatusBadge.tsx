"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';

type UserStatusValue = 'online' | 'away' | 'dnd' | 'offline';

interface UserStatus {
  status: UserStatusValue;
  status_text?: string | null;
  status_emoji?: string | null;
}

interface UserStatusBadgeProps {
  status?: UserStatus | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTooltip?: boolean;
}

const STATUS_COLOR: Record<UserStatusValue, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
};

const STATUS_LABEL: Record<UserStatusValue, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do not disturb',
  offline: 'Offline',
};

export function UserStatusDot({
  status,
  size = 'sm',
  className,
}: {
  status: UserStatusValue;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const dim =
    size === 'xs'
      ? 'w-1.5 h-1.5'
      : size === 'sm'
      ? 'w-2 h-2'
      : 'w-2.5 h-2.5';

  return (
    <span
      className={cn(
        'rounded-full border-2 border-background flex-shrink-0',
        dim,
        STATUS_COLOR[status],
        className
      )}
      title={STATUS_LABEL[status]}
    />
  );
}

export function UserStatusBadge({
  status,
  size = 'sm',
  className,
  showTooltip = true,
}: UserStatusBadgeProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (!status) return null;

  const hasCustomStatus = status.status_emoji ?? status.status_text;
  const tooltipContent = hasCustomStatus
    ? `${status.status_emoji ?? ''} ${status.status_text ?? ''}`.trim()
    : STATUS_LABEL[status.status];

  return (
    <div
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => showTooltip && setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      {status.status_emoji ? (
        <span className={cn('text-xs leading-none', size === 'xs' && 'text-[10px]')}>
          {status.status_emoji}
        </span>
      ) : (
        <UserStatusDot status={status.status} size={size} />
      )}

      {/* Tooltip */}
      {showTooltip && tooltipVisible && tooltipContent && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap max-w-[200px] truncate">
            {tooltipContent}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
        </div>
      )}
    </div>
  );
}
