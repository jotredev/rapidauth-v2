'use client';

import { DataTable, StatusBadge, type Column, type StatusType } from '@/components/dashboard';
import type { User } from '@/actions/users';
import { UserActions } from './user-actions';
import { USER_STATUS_MAP } from './types';
import { PROVIDER_CONFIG } from './provider-icons';

interface UsersTableProps {
  users: User[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isAdmin: boolean;
  currentUserId: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onChangeRole: (user: User) => void;
  onResetPassword: (user: User) => void;
  onResendInvitation: (user: User) => void;
  onToggleStatus: (user: User) => void;
  hiddenColumns: string[];
}

export function UsersTable({
  users,
  selectedIds,
  onSelectionChange,
  isAdmin,
  currentUserId,
  onEdit,
  onDelete,
  onChangeRole,
  onResetPassword,
  onResendInvitation,
  onToggleStatus,
  hiddenColumns,
}: UsersTableProps) {
  const allColumns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (item) => {
        const provider = PROVIDER_CONFIG[item.provider];
        const ProviderIcon = provider.icon;
        return (
          <div className='flex items-center gap-3'>
            <div className='flex flex-col'>
              <div className='flex items-center gap-2'>
                <span className='text-foreground font-normal'>{item.name}</span>
                <span
                  className={`${provider.color}`}
                  title={`Signed in with ${provider.label}`}
                >
                  <ProviderIcon className='h-3.5 w-3.5' />
                </span>
              </div>
              <span className='text-xs text-muted-foreground'>{item.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      render: (item) => (
        <span className='rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80'>{item.role}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const config = USER_STATUS_MAP[item.status] || {
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
        <span className='font-mono text-[13px] text-muted-foreground'>{item.createdAt}</span>
      ),
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      render: (item) => (
        <span className='text-muted-foreground'>{item.lastActive}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <UserActions
          user={item}
          isAdmin={isAdmin}
          isCurrentUser={item.id === currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
          onChangeRole={onChangeRole}
          onResetPassword={onResetPassword}
          onResendInvitation={onResendInvitation}
          onToggleStatus={onToggleStatus}
        />
      ),
    },
  ];
  const columns = allColumns.filter((c) => !hiddenColumns.includes(c.key));

  return (
    <DataTable
      columns={columns}
      data={users}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}
