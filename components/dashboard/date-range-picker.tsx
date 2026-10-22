'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DASHBOARD_RANGES,
  DASHBOARD_RANGE_LABELS,
  parseDashboardRange,
} from '@/lib/dashboard-range';

export function DateRangePicker(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = parseDashboardRange(searchParams.get('range') ?? undefined);

  const handleRangeChange = (value: string) => {
    const nextRange = parseDashboardRange(value);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('range', nextRange);
    router.replace(`/dashboard?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Date range"
          className="gap-2 text-[13px]"
        >
          <span className="rounded bg-muted px-1.5 font-mono text-[13px]">{range}</span>
          <span className="hidden sm:inline">{DASHBOARD_RANGE_LABELS[range]}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        <DropdownMenuRadioGroup value={range} onValueChange={handleRangeChange}>
          {DASHBOARD_RANGES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r} className="gap-2">
              <span className="rounded bg-muted px-1.5 font-mono text-[13px]">{r}</span>
              <span>{DASHBOARD_RANGE_LABELS[r]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
