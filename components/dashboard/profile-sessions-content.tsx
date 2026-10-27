'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TableView,
  type BulkAction,
  type RowAction,
  type TableViewColumn,
} from '@/components/dashboard/table-view';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { TableParams } from '@/lib/table-query';
import {
  profileSessionsTableQuery,
  type ProfileSessionsFilter,
} from '@/lib/profile-query';
import type { SessionData } from '@/actions/profile';
import {
  revokeAllOtherSessions,
  revokeSession,
  revokeSessions,
} from '@/actions/sessions';
import { formatUtc, parseUserAgent } from './activity-format';

const PROFILE_SESSIONS_COLUMNS: TableViewColumn<SessionData>[] = [
  {
    id: 'device',
    header: 'Device',
    required: true,
    render: (item) => {
      const { browser, os } = parseUserAgent(item.userAgent);
      return (
        <span className="flex items-center gap-2">
          <span className="text-sm">
            {browser} / {os}
          </span>
          {item.isCurrent && (
            <Badge variant="default" className="text-xs">
              Current
            </Badge>
          )}
        </span>
      );
    },
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
    id: 'signedIn',
    header: 'Signed in',
    render: (item) => (
      <span className="font-mono text-[13px] text-muted-foreground whitespace-nowrap">
        {formatUtc(item.createdAt)}
      </span>
    ),
  },
  {
    id: 'expires',
    header: 'Expires',
    render: (item) => (
      <span className="font-mono text-[13px] text-muted-foreground whitespace-nowrap">
        {formatUtc(item.expiresAt)}
      </span>
    ),
  },
];

const DESTRUCTIVE_BUTTON_CLASSES =
  'gap-2 shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10';

interface ProfileSessionsContentProps {
  sessions: SessionData[];
  total: number;
  totalPages: number;
  params: TableParams<ProfileSessionsFilter>;
  hiddenColumns: string[];
}

export function ProfileSessionsContent({
  sessions,
  total,
  totalPages,
  params,
  hiddenColumns,
}: ProfileSessionsContentProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionData | null>(
    null,
  );
  const [revokeOneOpen, setRevokeOneOpen] = useState(false);
  const [revokeSelectedOpen, setRevokeSelectedOpen] = useState(false);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);

  // The current session is always counted in `total`, so any more means other devices.
  const otherSessionsCount = Math.max(
    sessions.filter((session) => !session.isCurrent).length,
    total - 1,
  );

  const finishRevoke = (result: { response: string; message: string }) => {
    if (result.response === 'error') {
      toast.error(result.message);
      return;
    }
    setSelectedIds([]);
    toast.success(result.message);
    router.refresh();
  };

  const handleRevokeOne = async () => {
    if (!sessionToRevoke) return;
    finishRevoke(await revokeSession(sessionToRevoke.id));
  };

  const handleRevokeSelected = async () => {
    finishRevoke(await revokeSessions(selectedIds));
  };

  const handleRevokeOthers = async () => {
    finishRevoke(await revokeAllOtherSessions());
  };

  const rowActions = (session: SessionData): RowAction<SessionData>[] =>
    session.isCurrent
      ? []
      : [
          {
            id: 'revoke',
            label: 'Revoke session',
            icon: LogOut,
            destructive: true,
            onSelect: (row) => {
              setSessionToRevoke(row);
              setRevokeOneOpen(true);
            },
          },
        ];

  // The dialog reads `selectedIds`: store the ids TableView hands over before opening it.
  const bulkActions: BulkAction[] = [
    {
      id: 'revoke',
      label: 'Revoke',
      icon: LogOut,
      destructive: true,
      onSelect: (ids) => {
        setSelectedIds(ids);
        setRevokeSelectedOpen(true);
      },
    },
  ];

  const selectedCount = selectedIds.length;

  return (
    <>
      <TableView
        tableId="profile-sessions"
        basePath="/dashboard/profile"
        query={profileSessionsTableQuery}
        params={params}
        rows={sessions}
        total={total}
        totalPages={totalPages}
        columns={PROFILE_SESSIONS_COLUMNS}
        hiddenColumns={hiddenColumns}
        rowActions={rowActions}
        bulkActions={bulkActions}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        isRowSelectable={(session) => !session.isCurrent}
        toolbarActions={
          otherSessionsCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className={DESTRUCTIVE_BUTTON_CLASSES}
              onClick={() => setRevokeOthersOpen(true)}
            >
              <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
              Revoke other sessions
            </Button>
          ) : null
        }
        labels={{
          results: ({ from, to, total: count }) =>
            count === 0
              ? 'Showing 0 of 0 sessions'
              : `Showing ${from}–${to} of ${count} sessions`,
          empty: 'No active sessions.',
        }}
      />

      <ConfirmDialog
        open={revokeOneOpen}
        onOpenChange={setRevokeOneOpen}
        title="Revoke remote session"
        description="Are you sure you want to revoke this session? The device will be signed out immediately."
        confirmLabel="Revoke session"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleRevokeOne}
      />

      <ConfirmDialog
        open={revokeSelectedOpen}
        onOpenChange={setRevokeSelectedOpen}
        title="Revoke sessions"
        description={
          selectedCount === 1
            ? 'Revoke 1 session? That device will be signed out immediately.'
            : `Revoke ${selectedCount} sessions? Those devices will be signed out immediately.`
        }
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleRevokeSelected}
      />

      <ConfirmDialog
        open={revokeOthersOpen}
        onOpenChange={setRevokeOthersOpen}
        title="Revoke all other sessions"
        description={`Are you sure you want to revoke every session except the current one? This will sign out ${otherSessionsCount} ${otherSessionsCount === 1 ? 'device' : 'devices'}.`}
        confirmLabel="Revoke all"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleRevokeOthers}
      />
    </>
  );
}
