'use client';

import {
  TableView,
  type TableViewColumn,
  type TableViewFilter,
} from '@/components/dashboard/table-view';
import type { TableParams } from '@/lib/table-query';
import {
  ACTIVITY_ACTIONS,
  type ActivityTableFilter,
} from '@/lib/activity-log-query';
import { profileActivityTableQuery } from '@/lib/profile-query';
import type { ActivityLogEntry } from '@/actions/profile';
import { getActivityActionLabel } from './activity-action-labels';
import { formatUtc, parseUserAgent } from './activity-format';

const PROFILE_ACTIVITY_FILTERS: TableViewFilter<ActivityTableFilter>[] = [
  {
    key: 'action',
    label: 'Action Type',
    options: ACTIVITY_ACTIONS.map((action) => ({
      value: action,
      label: getActivityActionLabel(action),
    })),
  },
];

function getDetailsText(details: ActivityLogEntry['details']): string {
  if (!details) return '—';
  if (typeof details.provider === 'string' && details.provider) {
    return details.provider;
  }
  if (
    typeof details.field === 'string' &&
    details.field &&
    typeof details.newValue === 'string' &&
    details.newValue
  ) {
    return `${details.field}: ${details.newValue}`;
  }
  return '—';
}

const PROFILE_ACTIVITY_COLUMNS: TableViewColumn<ActivityLogEntry>[] = [
  {
    id: 'action',
    header: 'Action',
    required: true,
    render: (item) => (
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
        {getActivityActionLabel(item.action)}
      </span>
    ),
  },
  {
    id: 'details',
    header: 'Details',
    render: (item) => (
      <span className="text-xs text-muted-foreground">
        {getDetailsText(item.details)}
      </span>
    ),
  },
  {
    id: 'ipAddress',
    header: 'IP Address',
    render: (item) => (
      <span className="font-mono text-[13px] text-muted-foreground">
        {item.ipAddress || 'N/A'}
      </span>
    ),
  },
  {
    id: 'device',
    header: 'Device',
    render: (item) => {
      const { browser, os } = parseUserAgent(item.userAgent);
      return (
        <span className="text-xs text-muted-foreground">
          {browser} / {os}
        </span>
      );
    },
  },
  {
    id: 'time',
    header: 'Time',
    render: (item) => (
      <span className="font-mono text-[13px] text-muted-foreground whitespace-nowrap">
        {formatUtc(item.createdAt)}
      </span>
    ),
  },
];

interface ProfileActivityContentProps {
  logs: ActivityLogEntry[];
  total: number;
  totalPages: number;
  params: TableParams<ActivityTableFilter>;
  hiddenColumns: string[];
}

export function ProfileActivityContent({
  logs,
  total,
  totalPages,
  params,
  hiddenColumns,
}: ProfileActivityContentProps) {
  return (
    <TableView
      tableId="profile-activity"
      basePath="/dashboard/profile"
      query={profileActivityTableQuery}
      params={params}
      rows={logs}
      total={total}
      totalPages={totalPages}
      columns={PROFILE_ACTIVITY_COLUMNS}
      hiddenColumns={hiddenColumns}
      filters={PROFILE_ACTIVITY_FILTERS}
      labels={{
        results: ({ from, to, total: count }) =>
          count === 0
            ? 'Showing 0 of 0 events'
            : `Showing ${from}–${to} of ${count} events`,
        empty: 'No activity yet.',
      }}
    />
  );
}
