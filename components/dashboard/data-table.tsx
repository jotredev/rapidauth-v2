"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
  title?: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  tableClassName?: string;
}

export function DataTable<T extends { id: string }>({
  title,
  description,
  columns,
  data,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  viewAllHref,
  viewAllLabel = "View All",
  onRowClick,
  className,
  tableClassName,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(data.map((item) => item.id));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedIds, id]);
    } else {
      onSelectionChange?.(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  return (
    <section className={cn("flex flex-col", className)}>
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && (
              <span className="text-[13px] text-muted-foreground">
                {description}
              </span>
            )}
          </div>
          {viewAllHref && (
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link href={viewAllHref}>{viewAllLabel}</Link>
            </Button>
          )}
        </div>
      )}
      <div className={cn("overflow-x-auto", title && "border-t border-border")}>
        <Table className={cn("min-w-[800px]", tableClassName)}>
          <TableHeader>
            <TableRow className="border-b border-border">
              {selectable && (
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allSelected}
                    ref={(ref) => {
                      if (ref) {
                        (ref as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "text-sm font-semibold text-foreground whitespace-nowrap",
                    column.headerClassName
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, rowIndex) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TableRow
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "border-b border-border hover:bg-muted/50 transition-colors group",
                    onRowClick && "cursor-pointer",
                    rowIndex === data.length - 1 && "border-b-0"
                  )}
                >
                  {selectable && (
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectRow(item.id, checked as boolean)
                        }
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn("text-sm font-normal", column.className)}
                    >
                      {column.render
                        ? column.render(item, rowIndex)
                        : (item as Record<string, unknown>)[column.key] as React.ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
