'use client';

import * as React from 'react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/list-pagination';

export interface TableFooterLabels {
  rowsPerPage: string;
  page: (page: number, totalPages: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
}

const DEFAULT_LABELS: TableFooterLabels = {
  rowsPerPage: 'Rows per page',
  page: (page, totalPages) => `Page ${page} of ${totalPages}`,
  firstPage: 'Go to first page',
  previousPage: 'Go to previous page',
  nextPage: 'Go to next page',
  lastPage: 'Go to last page',
};

export interface TableFooterProps {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  isPending?: boolean;
  getPageHref: (page: number) => string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  labels?: Partial<TableFooterLabels>;
  /** Shown on the left, e.g. "Showing 1–20 of 45". */
  summary?: React.ReactNode;
  className?: string;
}

export function TableFooter({
  page,
  totalPages,
  pageSize,
  isPending,
  getPageHref,
  onPageChange,
  onPageSizeChange,
  labels: labelsProp,
  summary,
  className,
}: TableFooterProps): React.JSX.Element {
  const labels: TableFooterLabels = { ...DEFAULT_LABELS, ...labelsProp };
  const safeTotalPages = Math.max(1, totalPages);
  const firstDisabled = page <= 1;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= safeTotalPages;
  const lastDisabled = page >= safeTotalPages;

  const prevPage = Math.max(1, Math.min(safeTotalPages, page - 1));
  const nextPage = Math.max(1, Math.min(safeTotalPages, page + 1));
  const lastPage = safeTotalPages;

  const navigate =
    (targetPage: number, disabled: boolean) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (!disabled) onPageChange(targetPage);
    };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-3.5 border-t border-border px-5 py-2.5 text-sm',
        className,
      )}
      aria-busy={isPending}
    >
      {summary !== undefined && (
        <span className="mr-auto text-muted-foreground" aria-live="polite">
          {summary}
        </span>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{labels.rowsPerPage}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
        >
          <SelectTrigger size="sm" aria-label={labels.rowsPerPage} className="w-[76px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground" aria-live="polite">
        {labels.page(page, totalPages)}
      </span>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" asChild>
          <a
            href={getPageHref(1)}
            aria-label={labels.firstPage}
            aria-disabled={firstDisabled}
            tabIndex={firstDisabled ? -1 : undefined}
            className={cn(firstDisabled && 'pointer-events-none opacity-50')}
            onClick={navigate(1, firstDisabled)}
          >
            <ChevronsLeft className="size-4" strokeWidth={1.75} />
          </a>
        </Button>
        <Button variant="outline" size="icon-sm" asChild>
          <a
            href={getPageHref(prevPage)}
            aria-label={labels.previousPage}
            aria-disabled={prevDisabled}
            tabIndex={prevDisabled ? -1 : undefined}
            className={cn(prevDisabled && 'pointer-events-none opacity-50')}
            onClick={navigate(prevPage, prevDisabled)}
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </a>
        </Button>
        <Button variant="outline" size="icon-sm" asChild>
          <a
            href={getPageHref(nextPage)}
            aria-label={labels.nextPage}
            aria-disabled={nextDisabled}
            tabIndex={nextDisabled ? -1 : undefined}
            className={cn(nextDisabled && 'pointer-events-none opacity-50')}
            onClick={navigate(nextPage, nextDisabled)}
          >
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </a>
        </Button>
        <Button variant="outline" size="icon-sm" asChild>
          <a
            href={getPageHref(lastPage)}
            aria-label={labels.lastPage}
            aria-disabled={lastDisabled}
            tabIndex={lastDisabled ? -1 : undefined}
            className={cn(lastDisabled && 'pointer-events-none opacity-50')}
            onClick={navigate(lastPage, lastDisabled)}
          >
            <ChevronsRight className="size-4" strokeWidth={1.75} />
          </a>
        </Button>
      </div>
    </div>
  );
}
