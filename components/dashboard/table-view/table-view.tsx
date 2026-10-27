'use client';

import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTableRange } from '@/lib/table-query';
import { DataTable, type Column } from '../data-table';
import { ColumnPicker } from '../column-picker';
import { TableFooter } from '../table-footer';
import { TableToolbar } from './table-toolbar';
import { TableActiveFilters } from './table-active-filters';
import { TableBulkActionsBar } from './table-bulk-actions-bar';
import { TableRowActions } from './table-row-actions';
import { useTableUrlState } from './use-table-url-state';
import type { TableViewLabels, TableViewProps } from './types';

const ACTIONS_COLUMN_KEY = '__row-actions';

const DEFAULT_LABELS: TableViewLabels = {
  searchPlaceholder: 'Search...',
  clearSearch: 'Clear search',
  filters: 'Filters',
  clearAll: 'Clear all',
  activeFilters: 'Active filters:',
  columns: 'Columns',
  toggleColumns: 'Toggle columns',
  results: ({ from, to, total }) =>
    total === 0 ? 'Showing 0 of 0' : `Showing ${from}–${to} of ${total}`,
  selected: (count) => `${count} selected`,
  clearSelection: 'Clear selection',
  openRowMenu: 'Open menu',
  rowMenuTitle: 'Actions',
  removeFilter: (chip) => `Remove ${chip}`,
  empty: 'No results.',
  footer: {},
};

// Bold every number of the results text, whatever its language.
function emphasizeNumbers(text: string): React.ReactNode {
  return text.split(/(\d+)/).map((part, index) =>
    /^\d+$/.test(part) ? (
      <span key={index} className='font-semibold text-foreground'>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function TableView<T extends { id: string }, F extends string>({
  tableId,
  basePath,
  query,
  params,
  rows,
  total,
  totalPages,
  columns,
  hiddenColumns,
  filters = [],
  rowActions,
  bulkActions,
  selectedIds,
  onSelectionChange,
  isRowSelectable,
  onRowClick,
  labels: labelsProp,
  toolbarActions,
  tableClassName,
}: TableViewProps<T, F>) {
  const labels: TableViewLabels = { ...DEFAULT_LABELS, ...labelsProp };

  // Selection: controlled when both props are given, internal otherwise.
  const isControlled =
    selectedIds !== undefined && onSelectionChange !== undefined;
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const currentSelection = isControlled ? selectedIds : internalSelectedIds;
  const rowIds = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => isRowSelectable?.(row) ?? true)
          .map((row) => row.id),
      ),
    [rows, isRowSelectable],
  );
  // Rows can disappear after a refresh and some can never be selected:
  // only ids still in `rows` and selectable count.
  const validSelectedIds = useMemo(
    () => currentSelection.filter((id) => rowIds.has(id)),
    [currentSelection, rowIds],
  );
  const changeSelection = useCallback(
    (ids: string[]) => {
      if (!isControlled) setInternalSelectedIds(ids);
      onSelectionChange?.(ids);
    },
    [isControlled, onSelectionChange],
  );
  const clearSelection = useCallback(
    () => changeSelection([]),
    [changeSelection],
  );

  const {
    searchQuery,
    setSearchQuery,
    filters: filterValues,
    toggleFilterValue,
    removeFilterValue,
    clearFilters,
    clearAll,
    goToPage,
    setPageSize,
    getPageHref,
    isPending,
  } = useTableUrlState({
    basePath,
    query,
    params,
    onChange: clearSelection,
  });

  const [hidden, setHidden] = useState<string[]>(hiddenColumns);
  const [prevHiddenColumns, setPrevHiddenColumns] =
    useState<string[]>(hiddenColumns);
  if (hiddenColumns.join('.') !== prevHiddenColumns.join('.')) {
    setPrevHiddenColumns(hiddenColumns);
    setHidden(hiddenColumns);
  }

  // Unknown and required columns can never be hidden.
  const effectiveHidden = columns
    .filter((column) => !column.required && hidden.includes(column.id))
    .map((column) => column.id);

  const hasSearch = query.config.searchMaxLength !== undefined;
  const hasBulkActions = (bulkActions?.length ?? 0) > 0;
  const activeFilterCount = filters.reduce(
    (count, filter) => count + filterValues[filter.key].length,
    0,
  );
  const range = getTableRange(params.page, params.pageSize, total);

  const tableColumns: Column<T>[] = columns
    .filter((column) => !effectiveHidden.includes(column.id))
    .map((column) => ({
      key: column.id,
      header: column.header,
      className: column.className,
      headerClassName: column.headerClassName,
      render: (row) => column.render(row),
    }));

  if (rowActions) {
    tableColumns.push({
      key: ACTIONS_COLUMN_KEY,
      header: '',
      render: (row) => (
        <TableRowActions row={row} actions={rowActions(row)} labels={labels} />
      ),
    });
  }

  return (
    <div className='flex flex-col'>
      <div className='flex flex-col gap-2.5 px-5 py-2.5'>
        <TableToolbar
          hasSearch={hasSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          values={filterValues}
          activeFilterCount={activeFilterCount}
          onToggleFilterValue={toggleFilterValue}
          onClearFilters={clearFilters}
          labels={labels}
        >
          {toolbarActions}
          <ColumnPicker
            tableId={tableId}
            columns={columns.map(({ id, header, required }) => ({
              id,
              label: header,
              required,
            }))}
            hidden={effectiveHidden}
            onHiddenChange={setHidden}
            labels={labels}
          />
        </TableToolbar>
        {(searchQuery || activeFilterCount > 0) && (
          <TableActiveFilters
            filters={filters}
            values={filterValues}
            onRemoveFilterValue={removeFilterValue}
            onClearAll={clearAll}
            labels={labels}
          />
        )}
      </div>
      <div
        className={cn(
          'border-t border-border transition-opacity',
          isPending && 'opacity-50',
        )}
        aria-busy={isPending}
      >
        <DataTable
          columns={tableColumns}
          data={rows}
          selectable={hasBulkActions}
          selectedIds={validSelectedIds}
          onSelectionChange={changeSelection}
          isRowSelectable={isRowSelectable}
          onRowClick={onRowClick}
          // Line the first and last columns up with the page title and the toolbar (px-5).
          tableClassName={cn(
            '[&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5',
            // The selection checkbox starts on that same line instead of being centered.
            hasBulkActions &&
              '[&_tr>td:first-child:not(:only-child)]:text-left [&_th:first-child]:text-left',
            tableClassName,
          )}
          emptyMessage={labels.empty}
        />
      </div>
      <TableFooter
        page={params.page}
        totalPages={totalPages}
        pageSize={params.pageSize}
        isPending={isPending}
        getPageHref={getPageHref}
        onPageChange={goToPage}
        onPageSizeChange={setPageSize}
        labels={labels.footer}
        summary={emphasizeNumbers(labels.results({ ...range, total }))}
      />

      {hasBulkActions && validSelectedIds.length > 0 && (
        <TableBulkActionsBar
          selectedIds={validSelectedIds}
          actions={bulkActions ?? []}
          helpers={{ clearSelection }}
          labels={labels}
        />
      )}
    </div>
  );
}
