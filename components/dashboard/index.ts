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
  type Notification,
} from "./header";

export {
  PageHeader,
  exportAction,
  type DateRangeOption,
  type ActionButton,
  type PageHeaderProps,
} from "./page-header";

export { DashboardShell } from "./dashboard-shell";

// Page Content Components (Client)
export { DashboardContent } from "./dashboard-content";
export { UserWelcome } from "./user-welcome";
export { ProfileContent } from "./profile-content";
export { AccountDeletionDialog } from "./account-deletion-dialog";
export { TwoFactorStatus } from "./two-factor-setup";
export { ActivityLog, type ActivityLogEntry } from "./activity-log";
export { ActiveSessions, type SessionData } from "./active-sessions";
export { ActivityLogsContent } from "./activity-logs-content";
export { SystemLogsContent } from "./system-logs-content";

// User Management (from users folder)
export {
  UsersContent,
  UsersTable,
  SearchAndFilters,
  ActiveFilters,
  UserActions,
  BulkActionsBar,
  AddUserDialog,
  EditUserDialog,
  ChangeRoleDialog,
  ResetPasswordDialog,
  type Filters,
} from "./users";
export type { User, AuthProvider } from "@/actions/users";

// Confirm Dialog
export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

// Data Display Components
export {
  MetricCard,
  MetricGrid,
  metricIcons,
  type MetricCardProps,
  type MetricGridProps,
  type TrendDirection,
} from "./metric-card";

export {
  BarChart,
  createMonthlyData,
  monthlyLabels,
  type BarChartData,
  type BarChartProps,
} from "./bar-chart";

export {
  DataTable,
  type Column,
  type DataTableProps,
} from "./data-table";

export {
  StatusBadge,
  OrderStatusBadge,
  orderStatusMap,
  type StatusType,
  type StatusBadgeProps,
} from "./status-badge";
