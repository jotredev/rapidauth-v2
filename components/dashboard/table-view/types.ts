import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TableFooterLabels } from '../table-footer';
import type { TableParams, TableQuery } from '@/lib/table-query';

export interface TableViewColumn<T> {
  id: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Required columns cannot be hidden. */
  required?: boolean;
}

export interface TableViewFilterOption {
  value: string;
  label: string;
  /** Lucide or custom icon, drawn inside the option button. */
  icon?: React.ComponentType<{ className?: string }>;
}

export interface TableViewFilter<F extends string> {
  key: F;
  label: string;
  options: TableViewFilterOption[];
  /** Defaults to true. When false the filter is only shown as an active-filter tag. */
  showInPanel?: boolean;
  /** Defaults to `${label}: ${option.label}`. */
  formatChip?: (option: TableViewFilterOption) => string;
}

export interface RowAction<T> {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: (row: T) => void;
  href?: string;
  disabled?: boolean;
  /** Small text on the right of the item, e.g. "OAuth". */
  hint?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export interface BulkActionHelpers {
  clearSelection: () => void;
}

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: (ids: string[], helpers: BulkActionHelpers) => void;
  items?: {
    id: string;
    label: string;
    onSelect: (ids: string[], helpers: BulkActionHelpers) => void;
  }[];
  disabled?: boolean;
  /** Shown inside the button and as its `title`. */
  hint?: string;
  destructive?: boolean;
}

export interface TableViewLabels {
  searchPlaceholder: string;
  clearSearch: string;
  filters: string;
  clearAll: string;
  activeFilters: string;
  columns: string;
  toggleColumns: string;
  results: (range: { from: number; to: number; total: number }) => string;
  selected: (count: number) => string;
  clearSelection: string;
  openRowMenu: string;
  rowMenuTitle: string;
  /** aria-label of each active-filter tag. */
  removeFilter: (chip: string) => string;
  empty: React.ReactNode;
  footer: Partial<TableFooterLabels>;
}

export interface TableViewProps<T extends { id: string }, F extends string> {
  tableId: string;
  basePath: string;
  query: TableQuery<F>;
  params: TableParams<F>;
  rows: T[];
  total: number;
  totalPages: number;
  columns: TableViewColumn<T>[];
  hiddenColumns: string[];
  filters?: TableViewFilter<F>[];
  rowActions?: (row: T) => RowAction<T>[];
  bulkActions?: BulkAction[];
  /** Controlled selection: pass together with `onSelectionChange`. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Rows that return false cannot be selected: their checkbox is disabled and they never reach the bulk actions. */
  isRowSelectable?: (row: T) => boolean;
  onRowClick?: (row: T) => void;
  labels?: Partial<TableViewLabels>;
  /** Extra buttons next to "Columns". */
  toolbarActions?: React.ReactNode;
  tableClassName?: string;
}
