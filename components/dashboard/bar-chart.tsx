'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface BarChartData {
  key: string;
  label: string;
  value: number;
}

export interface BarChartProps {
  title: string;
  description?: string;
  data: BarChartData[];
  formatValue?: (value: number) => string;
  className?: string;
}

const defaultFormatValue = (value: number) => `${value} users`;

export function BarChart({
  title,
  description,
  data,
  formatValue = defaultFormatValue,
  className,
}: BarChartProps): React.JSX.Element {
  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const step = Math.ceil(data.length / 6);
  const visibleIndices = data
    .map((_, i) => (data.length <= 12 || i % step === 0 ? i : -1))
    .filter((i) => i !== -1);
  const lastVisibleIndex = visibleIndices[visibleIndices.length - 1];

  return (
    <section className={cn('flex flex-col px-5 py-4', className)}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Bars zone */}
      <div className="group/bars mt-4 flex h-[180px] items-end gap-1.5 border-b border-border">
        {data.map((item) => {
          const formatted = formatValue(item.value);
          const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const isZero = item.value === 0;

          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <div
                  data-slot="bar"
                  aria-label={`${item.label}: ${formatted}`}
                  className={cn(
                    'flex-1 rounded-t-[2px] opacity-85 transition-opacity group-hover/bars:opacity-35 hover:opacity-100!',
                    isZero ? 'bg-muted' : 'bg-foreground/80'
                  )}
                  style={{
                    height: isZero ? '2px' : `${heightPercent}%`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {item.label}: {formatted}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Labels below */}
      <div className="mt-2 flex gap-1.5 text-xs text-muted-foreground font-mono">
        {data.map((item, index) => {
          const showLabel = data.length <= 12 || index % step === 0;
          const isLastVisible = index === lastVisibleIndex;
          return (
            <span
              key={item.key}
              className={cn(
                'flex-1 min-w-0 overflow-visible whitespace-nowrap',
                isLastVisible ? 'text-right' : 'text-left'
              )}
            >
              {showLabel ? item.label : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}
