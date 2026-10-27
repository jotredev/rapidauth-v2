'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableViewFilter, TableViewLabels } from './types';

interface TableToolbarProps<F extends string> {
  hasSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: TableViewFilter<F>[];
  values: Record<F, string[]>;
  activeFilterCount: number;
  onToggleFilterValue: (key: F, value: string) => void;
  onClearFilters: () => void;
  labels: Pick<
    TableViewLabels,
    'searchPlaceholder' | 'clearSearch' | 'filters' | 'clearAll'
  >;
  /** Column picker and extra buttons, rendered on the right of the bar. */
  children?: React.ReactNode;
}

export function TableToolbar<F extends string>({
  hasSearch,
  searchQuery,
  onSearchChange,
  filters,
  values,
  activeFilterCount,
  onToggleFilterValue,
  onClearFilters,
  labels,
  children,
}: TableToolbarProps<F>) {
  const panelFilters = filters.filter((filter) => filter.showInPanel !== false);

  return (
    <div className='flex flex-col gap-2.5 sm:flex-row sm:items-center'>
      {hasSearch && (
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder={labels.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className='h-8 font-mono text-sm pl-9 bg-background border-border'
          />
          {searchQuery && (
            <button
              type='button'
              aria-label={labels.clearSearch}
              onClick={() => onSearchChange('')}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>
      )}

      {/* Filters, extra actions and the column picker always sit on the right. */}
      <div className='flex flex-wrap items-center justify-end gap-2.5 sm:ml-auto'>
        {panelFilters.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm' className='gap-2 shrink-0'>
                <SlidersHorizontal className='h-4 w-4' />
                {labels.filters}
                {activeFilterCount > 0 && (
                  <span className='rounded bg-muted px-1.5 text-[13px]'>
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align='end'
              className='w-80 p-0 bg-card border-border'
            >
              <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                <h4 className='text-sm font-semibold'>{labels.filters}</h4>
                {activeFilterCount > 0 && (
                  <button
                    type='button'
                    onClick={onClearFilters}
                    className='text-xs text-link hover:underline font-normal'
                  >
                    {labels.clearAll}
                  </button>
                )}
              </div>

              <div className='p-4 space-y-5'>
                {panelFilters.map((filter) => (
                  <div key={filter.key} className='space-y-3'>
                    <span className='block text-sm text-muted-foreground font-normal'>
                      {filter.label}
                    </span>
                    <div className='flex flex-wrap gap-2'>
                      {filter.options.map((option) => {
                        const Icon = option.icon;
                        const selected = values[filter.key].includes(
                          option.value,
                        );
                        return (
                          <button
                            key={option.value}
                            type='button'
                            aria-pressed={selected}
                            onClick={() =>
                              onToggleFilterValue(filter.key, option.value)
                            }
                            className={cn(
                              'px-3 py-1.5 text-xs border rounded-md transition-colors',
                              Icon && 'flex items-center gap-2',
                              selected
                                ? 'bg-muted text-foreground border-foreground/20'
                                : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted/50',
                            )}
                          >
                            {Icon && <Icon className='h-3.5 w-3.5' />}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {children}
      </div>
    </div>
  );
}
