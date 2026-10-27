// Dashboard Layout Components
export {
  Sidebar,
  MobileSidebar,
  DashboardSidebar,
  type NavItem,
  type NavSection,
  type UserProfile,
} from "./sidebar";

export {
  Header,
} from "./header";

export { DateRangePicker } from "./date-range-picker";

export {
  PageHeader,
  type ActionButton,
  type PageHeaderProps,
} from "./page-header";

export { DashboardShell } from "./dashboard-shell";
export { CommandPalette, type CommandPaletteProps, type CommandPalettePage } from "./command-palette";

// Page Content Components (Client)
export { DashboardContent } from "./dashboard-content";
export { UserWelcome } from "./user-welcome";
export { ProfileContent } from "./profile-content";
export { AccountDeletionDialog } from "./account-deletion-dialog";
export { TwoFactorStatus } from "./two-factor-setup";
export { ProfileSessionsContent } from "./profile-sessions-content";
export { ActivityLogsContent } from "./activity-logs-content";
export { ProfileActivityContent } from "./profile-activity-content";
export { SystemLogsContent } from "./system-logs-content";

// User Management (from users folder)
export {
  UsersContent,
  AddUserDialog,
  EditUserDialog,
  ChangeRoleDialog,
  ResetPasswordDialog,
} from "./users";
export type { User, AuthProvider } from "@/actions/users";

// Confirm Dialog
export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

// Data Display Components
export {
  MetricCard,
  MetricGrid,
  type MetricCardProps,
  type MetricGridProps,
} from "./metric-card";

export {
  BarChart,
  type BarChartData,
  type BarChartProps,
} from "./bar-chart";

export {
  DataTable,
  type Column,
  type DataTableProps,
} from "./data-table";
export {
  TableFooter,
  type TableFooterLabels,
  type TableFooterProps,
} from "./table-footer";
export {
  ColumnPicker,
  type ColumnPickerColumn,
  type ColumnPickerLabels,
  type ColumnPickerProps,
} from "./column-picker";

export {
  TableView,
  type BulkAction,
  type BulkActionHelpers,
  type RowAction,
  type TableViewColumn,
  type TableViewFilter,
  type TableViewFilterOption,
  type TableViewLabels,
  type TableViewProps,
} from "./table-view";

export {
  StatusBadge,
  OrderStatusBadge,
  orderStatusMap,
  type StatusType,
  type StatusBadgeProps,
} from "./status-badge";
