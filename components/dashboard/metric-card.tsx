'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value: number;
  change?: number | null; // sin variación: undefined o null → no se pinta nada
  changeLabel?: string; // p. ej. 'vs previous period'
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  className,
}: MetricCardProps): React.JSX.Element {
  const hasChange = typeof change === 'number';
  const isPositive = hasChange && change >= 0;
  const sign = isPositive ? '+' : '−';

  return (
    <div
      data-slot="metric"
      className={cn('px-5 py-3.5 transition-colors hover:bg-muted/40', className)}
    >
      <div className="text-[13px] text-muted-foreground">{title}</div>
      <div data-slot="metric-value" className="mt-1 text-2xl font-semibold">
        {value.toLocaleString('en-US')}
      </div>
      {hasChange && (
        <div
          className={cn(
            'text-xs',
            isPositive ? 'text-success' : 'text-destructive'
          )}
        >
          {sign}
          {Math.abs(change)}%
          {changeLabel ? ` ${changeLabel}` : ''}
        </div>
      )}
    </div>
  );
}

function getCellBorderClass(index: number): string {
  const mobileBorderB = index < 2 ? 'border-b border-border lg:border-b-0' : '';
  const isLastMobileInRow = index % 2 === 1;
  const isLastDesktopInRow = index % 4 === 3;

  if (isLastDesktopInRow) {
    return cn(mobileBorderB);
  }
  if (isLastMobileInRow) {
    return cn(mobileBorderB, 'lg:border-r lg:border-border');
  }
  return cn(mobileBorderB, 'border-r border-border');
}

export interface MetricGridProps {
  metrics: MetricCardProps[];
  className?: string;
}

export function MetricGrid({
  metrics,
  className,
}: MetricGridProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid grid-cols-2 border-b border-border lg:grid-cols-4',
        className
      )}
    >
      {metrics.map((metric, index) => (
        <MetricCard
          key={metric.title}
          {...metric}
          className={cn(getCellBorderClass(index), metric.className)}
        />
      ))}
    </div>
  );
}
