'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { writeHiddenColumnsCookie } from '@/lib/table-columns';
import { cn } from '@/lib/utils';

export interface ColumnPickerColumn {
  id: string;
  label: string;
  required?: boolean;
}

export interface ColumnPickerLabels {
  columns: string;
  toggleColumns: string;
}

export interface ColumnPickerProps {
  tableId: string;
  columns: readonly ColumnPickerColumn[];
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
  labels?: Partial<ColumnPickerLabels>;
  className?: string;
}

export function ColumnPicker({
  tableId,
  columns,
  hidden: hiddenProp,
  onHiddenChange,
  labels: labelsProp,
  className,
}: ColumnPickerProps): React.JSX.Element {
  const labels: ColumnPickerLabels = {
    columns: 'Columns',
    toggleColumns: 'Toggle columns',
    ...labelsProp,
  };
  // Unknown and required columns can never be hidden.
  const hidden = columns
    .filter((col) => !col.required && hiddenProp.includes(col.id))
    .map((col) => col.id);
  const total = columns.length;
  const visibles = total - hidden.length;

  const handleToggle = (columnId: string, checked: boolean) => {
    const nextHiddenSet = new Set(hidden);
    if (checked) {
      nextHiddenSet.delete(columnId);
    } else {
      nextHiddenSet.add(columnId);
    }

    const next = columns
      .filter((col) => !col.required && nextHiddenSet.has(col.id))
      .map((col) => col.id);

    writeHiddenColumnsCookie(tableId, next);
    onHiddenChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2 shrink-0', className)}
        >
          {labels.columns}
          <span className="rounded bg-muted px-1.5 text-[13px]">
            {visibles}/{total}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        <DropdownMenuLabel>{labels.toggleColumns}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const isChecked = !hidden.includes(column.id);
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={isChecked}
              disabled={column.required}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(checked) => {
                if (column.required) return;
                handleToggle(column.id, checked);
              }}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
