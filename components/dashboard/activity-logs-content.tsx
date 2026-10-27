'use client';

import * as React from 'react';
import {
  PageHeader,
  TableView,
  type TableViewColumn,
  type TableViewFilter,
  type RowAction,
} from '@/components/dashboard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Eye, Monitor, Globe, Clock } from 'lucide-react';
import type { TableParams } from '@/lib/table-query';
import {
  ACTIVITY_ACTIONS,
  activityLogTableQuery,
  type ActivityTableFilter,
} from '@/lib/activity-log-query';
import type { ActivityLog } from '@/actions/activity';
import { getActivityActionLabel } from './activity-action-labels';
import { formatUtc, parseUserAgent } from './activity-format';

const ACTIVITY_FILTERS: TableViewFilter<ActivityTableFilter>[] = [
  {
    key: 'action',
    label: 'Action Type',
    options: ACTIVITY_ACTIONS.map((action) => ({
      value: action,
      label: getActivityActionLabel(action),
    })),
  },
];

const ACTIVITY_COLUMNS: TableViewColumn<ActivityLog>[] = [
  {
    id: 'user',
    header: 'User',
    required: true,
    render: (item) => (
      <div className="flex flex-col">
        <span className="text-foreground font-normal">{item.userName}</span>
        <span className="text-xs text-muted-foreground">{item.userEmail}</span>
      </div>
    ),
  },
  {
    id: 'action',
    header: 'Action',
    render: (item) => (
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
        {getActivityActionLabel(item.action)}
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

interface ActivityLogsContentProps {
  logs: ActivityLog[];
  total: number;
  totalPages: number;
  params: TableParams<ActivityTableFilter>;
  hiddenColumns: string[];
}

export function ActivityLogsContent({
  logs,
  total,
  totalPages,
  params,
  hiddenColumns,
}: ActivityLogsContentProps) {
  const [selectedLog, setSelectedLog] = React.useState<ActivityLog | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = React.useState(false);

  const openDetailsSheet = (log: ActivityLog) => {
    setSelectedLog(log);
    setDetailsSheetOpen(true);
  };

  const rowActions = (log: ActivityLog): RowAction<ActivityLog>[] => [
    {
      id: 'view-details',
      label: 'View details',
      icon: Eye,
      onSelect: () => openDetailsSheet(log),
    },
  ];

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="Monitor user activities and system events."
      />

      <TableView
        tableId="activity"
        basePath="/dashboard/activity"
        query={activityLogTableQuery}
        params={params}
        rows={logs}
        total={total}
        totalPages={totalPages}
        columns={ACTIVITY_COLUMNS}
        hiddenColumns={hiddenColumns}
        filters={ACTIVITY_FILTERS}
        rowActions={rowActions}
        onRowClick={openDetailsSheet}
        labels={{
          searchPlaceholder: 'Search by user, email, action, or IP...',
          results: ({ from, to, total: count }) =>
            count === 0
              ? 'Showing 0 of 0 logs'
              : `Showing ${from}–${to} of ${count} logs`,
        }}
      />

      {/* Details Sheet */}
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Activity Details</SheetTitle>
            <SheetDescription>
              Full details of the selected activity log.
            </SheetDescription>
          </SheetHeader>
          {selectedLog && (
            <div className="p-4 space-y-6">
              {/* User Info */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">User</p>
                <p className="font-semibold">{selectedLog.userName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLog.userEmail}
                </p>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Action</p>
                <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
                  {getActivityActionLabel(selectedLog.action)}
                </span>
              </div>

              {/* IP Address */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> IP Address
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {selectedLog.ipAddress || 'N/A'}
                </p>
              </div>

              {/* Timestamp */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Timestamp
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {formatUtc(selectedLog.createdAt)} UTC
                </p>
              </div>

              {/* Device Info */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> Device Info
                </p>
                {(() => {
                  const { browser, os } = parseUserAgent(selectedLog.userAgent);
                  return (
                    <p className="text-sm">
                      {browser} on {os}
                    </p>
                  );
                })()}
                {selectedLog.userAgent && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">
                    {selectedLog.userAgent}
                  </p>
                )}
              </div>

              {/* Additional Details */}
              {selectedLog.details && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Additional Details
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
