'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  BulkAction,
  BulkActionHelpers,
  TableViewLabels,
} from './types';

const DESTRUCTIVE_CLASSES =
  'text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10';

interface TableBulkActionsBarProps {
  selectedIds: string[];
  actions: BulkAction[];
  helpers: BulkActionHelpers;
  labels: Pick<TableViewLabels, 'selected' | 'clearSelection'>;
}

export function TableBulkActionsBar({
  selectedIds,
  actions,
  helpers,
  labels,
}: TableBulkActionsBarProps) {
  return (
    <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200'>
      <div className='flex items-center gap-2 bg-card border border-border rounded-lg shadow-lg px-4 py-3'>
        <div className='flex items-center gap-3 pr-3 border-r border-border'>
          <span className='text-sm font-medium'>
            {labels.selected(selectedIds.length)}
          </span>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            aria-label={labels.clearSelection}
            onClick={helpers.clearSelection}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <>
                {Icon && <Icon className='h-4 w-4' />}
                {action.label}
                {action.hint && (
                  <span className='text-[10px] text-muted-foreground'>
                    {action.hint}
                  </span>
                )}
                {action.items && <ChevronDown className='h-3 w-3' />}
              </>
            );
            const className = cn(
              'gap-2',
              action.destructive && DESTRUCTIVE_CLASSES,
            );

            if (action.items) {
              return (
                <DropdownMenu key={action.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      className={className}
                      disabled={action.disabled}
                      title={action.hint}
                    >
                      {content}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className='bg-card border-border'>
                    {action.items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => item.onSelect(selectedIds, helpers)}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Button
                key={action.id}
                variant='outline'
                size='sm'
                className={className}
                disabled={action.disabled}
                title={action.hint}
                onClick={() => action.onSelect?.(selectedIds, helpers)}
              >
                {content}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
