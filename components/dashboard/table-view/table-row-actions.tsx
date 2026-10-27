'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RowAction, TableViewLabels } from './types';

interface TableRowActionsProps<T> {
  row: T;
  actions: RowAction<T>[];
  labels: Pick<TableViewLabels, 'openRowMenu' | 'rowMenuTitle'>;
}

export function TableRowActions<T>({
  row,
  actions,
  labels,
}: TableRowActionsProps<T>) {
  if (actions.length === 0) return null;

  return (
    // Menu events bubble through React portals: keep them away from onRowClick.
    <span className='inline-flex' onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8'>
            <MoreHorizontal className='h-4 w-4' />
            <span className='sr-only'>{labels.openRowMenu}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48 bg-card border-border'>
          <DropdownMenuLabel className='font-normal text-muted-foreground'>
            {labels.rowMenuTitle}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className='bg-border' />

          {actions.map((action, index) => {
            const Icon = action.icon;
            const content = (
              <>
                {Icon && <Icon className='mr-2 h-4 w-4' />}
                {action.label}
                {action.hint && (
                  <span className='ml-auto text-[10px] text-muted-foreground'>
                    {action.hint}
                  </span>
                )}
              </>
            );

            return (
              <React.Fragment key={action.id}>
                {action.separatorBefore && index > 0 && (
                  <DropdownMenuSeparator className='bg-border' />
                )}
                {action.disabled ? (
                  <DropdownMenuItem
                    disabled
                    className='cursor-not-allowed opacity-50'
                  >
                    {content}
                  </DropdownMenuItem>
                ) : action.href ? (
                  <DropdownMenuItem
                    asChild
                    className={cn(
                      'cursor-pointer',
                      action.destructive &&
                        'text-destructive focus:text-destructive',
                    )}
                  >
                    <Link href={action.href}>{content}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => action.onSelect?.(row)}
                    className={cn(
                      'cursor-pointer',
                      action.destructive &&
                        'text-destructive focus:text-destructive',
                    )}
                  >
                    {content}
                  </DropdownMenuItem>
                )}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
