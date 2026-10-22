'use client';

import * as React from 'react';
import {
  PageHeader,
  MetricGrid,
  BarChart,
  DataTable,
  StatusBadge,
  type Column,
  type StatusType,
} from '@/components/dashboard';
import type {
  DashboardMetrics,
  ChartPoint,
  RecentUser,
} from '@/actions/dashboard';
import type { BucketUnit, DashboardRange } from '@/lib/dashboard-range';

const userStatusMap: Record<string, { status: StatusType; label: string }> = {
  active: { status: 'success', label: 'Active' },
  pending: { status: 'warning', label: 'Pending' },
  inactive: { status: 'error', label: 'Inactive' },
};

const columns: Column<RecentUser>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (item) => (
      <div className="flex flex-col">
        <span className="text-foreground font-normal">{item.name}</span>
        <span className="text-xs text-muted-foreground">{item.email}</span>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    render: (item) => (
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
        {item.role}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => {
      const config = userStatusMap[item.status] || {
        status: 'neutral' as StatusType,
        label: item.status,
      };
      return <StatusBadge status={config.status} label={config.label} />;
    },
  },
  {
    key: 'createdAt',
    header: 'Joined',
    render: (item) => (
      <span className="font-mono text-[13px] text-muted-foreground">{item.createdAt}</span>
    ),
  },
];

export interface DashboardContentProps {
  metrics: DashboardMetrics;
  chartData: ChartPoint[];
  unit: BucketUnit;
  range: DashboardRange;
  recentUsers: RecentUser[];
}

export function DashboardContent({
  metrics,
  chartData,
  unit,
  recentUsers,
}: DashboardContentProps): React.JSX.Element {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your user base and activity."
      />

      <div className="flex flex-col">
        <MetricGrid
          metrics={[
            {
              title: 'Total Users',
              value: metrics.totalUsers,
              change: metrics.totalUsersChange,
              changeLabel: 'in period',
            },
            { title: 'Active Users', value: metrics.activeUsers },
            { title: 'Inactive Users', value: metrics.inactiveUsers },
            {
              title: 'New in period',
              value: metrics.newInPeriod,
              change: metrics.newInPeriodChange,
              changeLabel: 'vs previous period',
            },
          ]}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
          <BarChart
            title="User Growth"
            description={`New user registrations per ${unit}.`}
            data={chartData}
            className="min-w-0 border-b border-border lg:border-b-0 lg:border-r"
          />
          <DataTable
            title="Recent Users"
            description="Latest registered users on the platform."
            columns={columns}
            data={recentUsers}
            viewAllHref="/dashboard/users"
            viewAllLabel="View All Users"
            className="min-w-0"
            tableClassName="min-w-0"
          />
        </div>
      </div>
    </>
  );
}
