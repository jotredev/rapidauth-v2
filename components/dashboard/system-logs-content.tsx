'use client';

import * as React from 'react';
import {
  PageHeader,
  TableView,
  type TableViewColumn,
  type TableViewFilter,
} from '@/components/dashboard';
import type { TableParams } from '@/lib/table-query';
import {
  OPERATIONAL_LOG_CODES,
  OPERATIONAL_LOG_LEVELS,
  OPERATIONAL_LOG_SOURCES,
  type OperationalLogTableFilter,
  operationalLogTableQuery,
} from '@/lib/operational-log-query';
import type { OperationalLogLevel } from '@/lib/operational-log';
import type {
  OperationalLogItem,
  OperationalLogMetadata,
  OperationalLogUser,
} from '@/actions/operational-logs';

interface SystemLogsContentProps {
  logs: OperationalLogItem[];
  total: number;
  totalPages: number;
  params: TableParams<OperationalLogTableFilter>;
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

const LEVEL_LABELS: Record<OperationalLogLevel, string> = {
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  critical: 'Critical',
};

const SYSTEM_LOG_COLUMNS: TableViewColumn<OperationalLogItem>[] = [
  {
    id: 'time',
    header: 'Time',
    required: true,
    headerClassName: 'w-48',
    className: 'text-xs font-mono whitespace-nowrap text-muted-foreground',
    render: (log) => formatUtc(log.createdAt),
  },
  {
    id: 'level',
    header: 'Level',
    headerClassName: 'w-24',
    render: (log) => renderLevelBadge(log.level),
  },
  {
    id: 'source',
    header: 'Source',
    headerClassName: 'w-28',
    className: 'text-xs font-mono text-muted-foreground',
    render: (log) => log.source,
  },
  {
    id: 'code',
    header: 'Code',
    headerClassName: 'w-52',
    className: 'text-xs font-mono font-normal',
    render: (log) => log.code,
  },
  {
    id: 'user',
    header: 'User',
    headerClassName: 'w-48',
    render: (log) =>
      log.user ? (
        <div className="flex flex-col">
          <span className="font-normal text-foreground">{log.user.name}</span>
          <span className="text-xs text-muted-foreground">
            {log.user.email}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'details',
    header: 'Details',
    className: 'text-xs font-mono',
    render: (log) => renderDetails(log.metadata),
  },
];

export function SystemLogsContent({
  logs,
  total,
  totalPages,
  params,
  filterUser,
  hiddenColumns,
}: SystemLogsContentProps) {
  const filters: TableViewFilter<OperationalLogTableFilter>[] = [
    {
      key: 'level',
      label: 'Level',
      options: OPERATIONAL_LOG_LEVELS.map((level) => ({
        value: level,
        label: LEVEL_LABELS[level],
      })),
    },
    {
      key: 'source',
      label: 'Source',
      options: OPERATIONAL_LOG_SOURCES.map((source) => ({
        value: source,
        label: source,
      })),
    },
    {
      key: 'code',
      label: 'Code',
      options: OPERATIONAL_LOG_CODES.map((code) => ({
        value: code,
        label: code,
      })),
    },
    {
      // Set from the users menu link: only shown as an active-filter tag.
      key: 'user',
      label: 'User',
      showInPanel: false,
      options: params.filters.user[0]
        ? [
            {
              value: params.filters.user[0],
              label: filterUser
                ? `${filterUser.name} (${filterUser.email})`
                : 'deleted',
            },
          ]
        : [],
    },
  ];

  return (
    <>
      <PageHeader
        title="System logs"
        description="Delivery events and other operational records. Email addresses, codes and tokens are never stored."
      />

      <TableView
        tableId="system-logs"
        basePath="/dashboard/logs"
        query={operationalLogTableQuery}
        params={params}
        rows={logs}
        total={total}
        totalPages={totalPages}
        columns={SYSTEM_LOG_COLUMNS}
        hiddenColumns={hiddenColumns}
        filters={filters}
        labels={{
          results: ({ from, to, total: count }) =>
            count === 0
              ? 'Showing 0 of 0 logs'
              : `Showing ${from}–${to} of ${count} logs`,
          empty: 'No logs match these filters.',
        }}
      />
    </>
  );
}
