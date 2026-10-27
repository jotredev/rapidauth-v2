'use client';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { TableViewFilter, TableViewLabels } from './types';

interface TableActiveFiltersProps<F extends string> {
  filters: TableViewFilter<F>[];
  values: Record<F, string[]>;
  onRemoveFilterValue: (key: F, value: string) => void;
  onClearAll: () => void;
  labels: Pick<TableViewLabels, 'activeFilters' | 'clearAll' | 'removeFilter'>;
}

export function TableActiveFilters<F extends string>({
  filters,
  values,
  onRemoveFilterValue,
  onClearAll,
  labels,
}: TableActiveFiltersProps<F>) {
  const chips = filters.flatMap((filter) =>
    values[filter.key].map((value) => {
      const option = filter.options.find((item) => item.value === value);
      // A value that is not among the options is shown as is.
      const text = option
        ? (filter.formatChip?.(option) ?? `${filter.label}: ${option.label}`)
        : value;
      return { key: filter.key, value, text };
    }),
  );

  if (chips.length === 0) return null;

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='text-xs text-muted-foreground'>
        {labels.activeFilters}
      </span>

      {chips.map((chip) => (
        <Badge
          key={`${chip.key}-${chip.value}`}
          asChild
          variant='outline'
          className='gap-1 cursor-pointer font-normal'
        >
          <button
            type='button'
            aria-label={labels.removeFilter(chip.text)}
            onClick={() => onRemoveFilterValue(chip.key, chip.value)}
          >
            {chip.text}
            <X className='h-3 w-3' />
          </button>
        </Badge>
      ))}

      <button
        type='button'
        onClick={onClearAll}
        className='text-xs text-muted-foreground hover:text-foreground ml-2'
      >
        {labels.clearAll}
      </button>
    </div>
  );
}
