'use client';

import * as React from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { SlidersHorizontal, X } from 'lucide-react';
import { PageHeader, ColumnPicker } from '@/components/dashboard';
import { TABLE_COLUMNS } from '@/lib/table-columns';
import { TableFooter } from '@/components/dashboard/table-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PageSize } from '@/lib/list-pagination';
import {
  buildOperationalLogQueryString,
  OPERATIONAL_LOG_CODES,
  OPERATIONAL_LOG_LEVELS,
  OPERATIONAL_LOG_SOURCES,
  type OperationalLogListParams,
} from '@/lib/operational-log-query';
import type {
  OperationalLogLevel,
  OperationalLogSource,
  OperationalLogCode,
} from '@/lib/operational-log';
import type {
  OperationalLogItem,
  OperationalLogMetadata,
  OperationalLogUser,
} from '@/actions/operational-logs';

interface SystemLogsContentProps {
  logs: OperationalLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  initialParams: OperationalLogListParams;
  filterUser: OperationalLogUser | null;
  hiddenColumns: string[];
}

function formatUtc(isoString: string): string {
  return `${new Date(isoString).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function renderLevelBadge(level: OperationalLogLevel) {
  switch (level) {
    case 'info':
      return (
        <span className="font-mono text-[13px] text-muted-foreground">
          {level}
        </span>
      );
    case 'warn':
      return (
        <span className="font-mono text-[13px] text-warning">
          {level}
        </span>
      );
    case 'error':
      return (
        <span className="font-mono text-[13px] text-destructive">
          {level}
        </span>
      );
    case 'critical':
      return (
        <span className="font-mono text-[13px] font-semibold text-destructive">
          {level}
        </span>
      );
  }
}

function renderDetails(metadata: OperationalLogMetadata | null) {
  if (!metadata) return <span className="text-muted-foreground">—</span>;

  const parts: React.ReactNode[] = [];
  if (metadata.template) {
    parts.push(<span key="template">template: {metadata.template}</span>);
  }
  if (typeof metadata.durationMs === 'number') {
    parts.push(<span key="duration">{metadata.durationMs}ms</span>);
  }
  if (metadata.errorCode) {
    parts.push(
      <span key="errorCode" className="text-destructive font-normal">
        errorCode: {metadata.errorCode}
      </span>,
    );
  }

  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-muted-foreground/40">•</span>}
          {part}
        </React.Fragment>
      ))}
    </div>
  );
}

export function SystemLogsContent({
  logs,
  total,
  page,
  pageSize,
  totalPages,
  initialParams,
  filterUser,
  hiddenColumns,
}: SystemLogsContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [hidden, setHidden] = React.useState<string[]>(hiddenColumns);
  const [prevHiddenColumns, setPrevHiddenColumns] = React.useState<string[]>(hiddenColumns);

  if (hiddenColumns.join('.') !== prevHiddenColumns.join('.')) {
    setPrevHiddenColumns(hiddenColumns);
    setHidden(hiddenColumns);
  }

  const visibleColumnsCount = TABLE_COLUMNS['system-logs'].length - hidden.length;

  const navigateWithParams = React.useCallback(
    (nextParams: OperationalLogListParams) => {
      startTransition(() => {
        router.push(
          `/dashboard/logs?${buildOperationalLogQueryString(nextParams)}`,
        );
      });
    },
    [router],
  );

  const toggleLevel = (level: OperationalLogLevel) => {
    const nextLevels = initialParams.levels.includes(level)
      ? initialParams.levels.filter((l) => l !== level)
      : [...initialParams.levels, level];
    navigateWithParams({
      ...initialParams,
      page: 1,
      levels: nextLevels,
    });
  };

  const handleSourceChange = (value: string) => {
    navigateWithParams({
      ...initialParams,
      page: 1,
      source: value === 'all' ? null : (value as OperationalLogSource),
    });
  };

  const handleCodeChange = (value: string) => {
    navigateWithParams({
      ...initialParams,
      page: 1,
      code: value === 'all' ? null : (value as OperationalLogCode),
    });
  };

  const handleRemoveUserFilter = () => {
    navigateWithParams({
      ...initialParams,
      page: 1,
      userId: null,
    });
  };

  const handleClearFilters = () => {
    navigateWithParams({
      page: 1,
      pageSize: initialParams.pageSize,
      levels: [],
      source: null,
      code: null,
      userId: null,
    });
  };

  const handlePageChange = (newPage: number) => {
    navigateWithParams({
      ...initialParams,
      page: newPage,
    });
  };

  const handlePageSizeChange = (newPageSize: PageSize) => {
    navigateWithParams({
      ...initialParams,
      page: 1,
      pageSize: newPageSize,
    });
  };

  const getPageHref = React.useCallback(
    (targetPage: number) =>
      `/dashboard/logs?${buildOperationalLogQueryString({
        ...initialParams,
        page: targetPage,
      })}`,
    [initialParams],
  );

  const hasActiveFilters =
    initialParams.levels.length > 0 ||
    initialParams.source !== null ||
    initialParams.code !== null ||
    initialParams.userId !== null;

  return (
    <>
      <PageHeader
        title="System logs"
        description="Delivery events and other operational records. Email addresses, codes and tokens are never stored."
      />

      <div className="flex flex-col">
        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-2.5 px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Level Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Level</span>
                  {initialParams.levels.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]"
                    >
                      {initialParams.levels.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-card border-border">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Filter by Level
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPERATIONAL_LOG_LEVELS.map((lvl) => (
                  <DropdownMenuCheckboxItem
                    key={lvl}
                    checked={initialParams.levels.includes(lvl)}
                    onCheckedChange={() => toggleLevel(lvl)}
                    className="capitalize cursor-pointer"
                  >
                    {lvl}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Source Filter */}
            <Select
              value={initialParams.source ?? 'all'}
              onValueChange={handleSourceChange}
            >
              <SelectTrigger size="sm" className="w-36 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All sources</SelectItem>
                {OPERATIONAL_LOG_SOURCES.map((src) => (
                  <SelectItem key={src} value={src}>
                    {src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Code Filter */}
            <Select
              value={initialParams.code ?? 'all'}
              onValueChange={handleCodeChange}
            >
              <SelectTrigger size="sm" className="w-52 text-xs font-mono">
                <SelectValue placeholder="Code" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-xs">
                <SelectItem value="all">All codes</SelectItem>
                {OPERATIONAL_LOG_CODES.map((cd) => (
                  <SelectItem key={cd} value={cd}>
                    {cd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Clear filters
              </Button>
            )}

            <div className="ml-auto">
              <ColumnPicker
                tableId="system-logs"
                hidden={hidden}
                onHiddenChange={setHidden}
              />
            </div>
          </div>

          {/* Active chips / summary */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {initialParams.userId && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs"
                  >
                    <span>
                      User:{' '}
                      {filterUser
                        ? `${filterUser.name} (${filterUser.email})`
                        : 'deleted'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveUserFilter}
                      className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Remove user filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {total === 0
                ? 'Showing 0 of 0 logs'
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                    page * pageSize,
                    total,
                  )} of ${total} logs`}
            </p>
          </div>
        </div>

        {/* Logs Table */}
        <div
          className={cn('border-t border-border transition-opacity', isPending && 'opacity-50')}
          aria-busy={isPending}
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b border-border">
                  {!hidden.includes('time') && (
                    <TableHead className="text-sm font-semibold text-foreground w-48">
                      Time
                    </TableHead>
                  )}
                  {!hidden.includes('level') && (
                    <TableHead className="text-sm font-semibold text-foreground w-24">
                      Level
                    </TableHead>
                  )}
                  {!hidden.includes('source') && (
                    <TableHead className="text-sm font-semibold text-foreground w-28">
                      Source
                    </TableHead>
                  )}
                  {!hidden.includes('code') && (
                    <TableHead className="text-sm font-semibold text-foreground w-52">
                      Code
                    </TableHead>
                  )}
                  {!hidden.includes('user') && (
                    <TableHead className="text-sm font-semibold text-foreground w-48">
                      User
                    </TableHead>
                  )}
                  {!hidden.includes('details') && (
                    <TableHead className="text-sm font-semibold text-foreground">
                      Details
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumnsCount}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      No logs match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      {!hidden.includes('time') && (
                        <TableCell className="text-xs font-mono whitespace-nowrap text-muted-foreground">
                          {formatUtc(log.createdAt)}
                        </TableCell>
                      )}
                      {!hidden.includes('level') && (
                        <TableCell>{renderLevelBadge(log.level)}</TableCell>
                      )}
                      {!hidden.includes('source') && (
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.source}
                        </TableCell>
                      )}
                      {!hidden.includes('code') && (
                        <TableCell className="text-xs font-mono font-normal">
                          {log.code}
                        </TableCell>
                      )}
                      {!hidden.includes('user') && (
                        <TableCell className="text-sm">
                          {log.user ? (
                            <div className="flex flex-col">
                              <span className="font-normal text-foreground">
                                {log.user.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {log.user.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {!hidden.includes('details') && (
                        <TableCell className="text-xs font-mono">
                          {renderDetails(log.metadata)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <TableFooter
          page={page}
          totalPages={totalPages}
          pageSize={initialParams.pageSize}
          isPending={isPending}
          getPageHref={getPageHref}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </>
  );
}
