'use client';

import { cn } from '@/lib/utils';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
  info: 'text-link',
  neutral: 'text-muted-foreground',
};

export function StatusBadge({
  status,
  label,
  showDot = false,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-normal',
        config,
        className,
      )}
    >
      {showDot && (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

// Common status mappings
export const orderStatusMap: Record<
  string,
  { status: StatusType; label: string }
> = {
  fulfilled: { status: 'success', label: 'Fulfilled' },
  processing: { status: 'warning', label: 'Processing' },
  pending: { status: 'info', label: 'Pending' },
  refunded: { status: 'error', label: 'Refunded' },
  cancelled: { status: 'error', label: 'Cancelled' },
};

export function OrderStatusBadge({ orderStatus }: { orderStatus: string }) {
  const config = orderStatusMap[orderStatus.toLowerCase()] || {
    status: 'neutral' as StatusType,
    label: orderStatus,
  };
  return <StatusBadge status={config.status} label={config.label} />;
}
