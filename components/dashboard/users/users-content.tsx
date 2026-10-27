'use client';

import { useCallback, useState } from 'react';
import {
  PageHeader,
  StatusBadge,
  TableView,
  type RowAction,
  type StatusType,
  type TableViewColumn,
  type TableViewFilter,
  type BulkAction,
} from '@/components/dashboard';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { User } from '@/actions/users';
import type { TableParams } from '@/lib/table-query';
import {
  USER_PROVIDERS,
  USER_ROLES,
  USER_STATUSES,
  userTableQuery,
  type UserTableFilter,
} from '@/lib/user-list-query';
import { useUserDialogs, useUserActions } from './hooks';
import { AddUserDialog } from './add-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { ChangeRoleDialog } from './change-role-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';
import { USER_STATUS_MAP } from './types';
import { PROVIDER_CONFIG } from './provider-icons';
import {
  Ban,
  KeyRound,
  Mail,
  MailPlus,
  Pencil,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';

const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  user: 'User',
};

const USER_FILTERS: TableViewFilter<UserTableFilter>[] = [
  {
    key: 'role',
    label: 'Role',
    options: USER_ROLES.map((role) => ({
      value: role,
      label: ROLE_LABELS[role],
    })),
  },
  {
    key: 'status',
    label: 'Status',
    options: USER_STATUSES.map((status) => ({
      value: status,
      label: USER_STATUS_MAP[status].label,
    })),
  },
  {
    key: 'provider',
    label: 'Auth Provider',
    options: USER_PROVIDERS.map((provider) => ({
      value: provider,
      label: PROVIDER_CONFIG[provider].label,
      icon: PROVIDER_CONFIG[provider].icon,
    })),
  },
];

const USER_COLUMNS: TableViewColumn<User>[] = [
  {
    id: 'name',
    header: 'User',
    required: true,
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
    id: 'role',
    header: 'Role',
    render: (item) => (
      <span className='rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80'>{item.role}</span>
    ),
  },
  {
    id: 'status',
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
    id: 'createdAt',
    header: 'Joined',
    render: (item) => (
      <span className='font-mono text-[13px] text-muted-foreground'>{item.createdAt}</span>
    ),
  },
  {
    id: 'lastActive',
    header: 'Last Active',
    render: (item) => (
      <span className='text-muted-foreground'>{item.lastActive}</span>
    ),
  },
];

interface UsersContentProps {
  users: User[];
  total: number;
  totalPages: number;
  params: TableParams<UserTableFilter>;
  isAdmin?: boolean;
  currentUserId: string;
  hiddenColumns: string[];
}

export function UsersContent({
  users,
  total,
  totalPages,
  params,
  isAdmin = true,
  currentUserId,
  hiddenColumns,
}: UsersContentProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const {
    selectedUser,
    bulkRole,
    addDialogOpen,
    setAddDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    roleDialogOpen,
    setRoleDialogOpen,
    resetPasswordDialogOpen,
    setResetPasswordDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    statusDialogOpen,
    setStatusDialogOpen,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    bulkActivateDialogOpen,
    setBulkActivateDialogOpen,
    bulkDeactivateDialogOpen,
    setBulkDeactivateDialogOpen,
    bulkRoleDialogOpen,
    setBulkRoleDialogOpen,
    openAddDialog,
    openEditDialog,
    openRoleDialog,
    openResetPasswordDialog,
    openStatusDialog,
    openDeleteDialog,
    openBulkRoleDialog,
    openBulkActivateDialog,
    openBulkDeactivateDialog,
    openBulkDeleteDialog,
  } = useUserDialogs();

  const {
    handleToggleStatus,
    handleDeleteUser,
    handleResendInvitation,
    handleBulkActivate,
    handleBulkDeactivate,
    handleBulkChangeRole,
    handleBulkDelete,
  } = useUserActions({
    selectedUser,
    selectedIds,
    bulkRole,
    onClearSelection: clearSelection,
    onCloseBulkActivateDialog: () => setBulkActivateDialogOpen(false),
    onCloseBulkDeactivateDialog: () => setBulkDeactivateDialogOpen(false),
    onCloseBulkRoleDialog: () => setBulkRoleDialogOpen(false),
    onCloseBulkDeleteDialog: () => setBulkDeleteDialogOpen(false),
  });

  const rowActions = (user: User): RowAction<User>[] => {
    const isOAuthUser = user.provider !== 'email';
    const isCurrentUser = user.id === currentUserId;
    const isActive = user.status === 'active';

    const actions: RowAction<User>[] = [
      isOAuthUser
        ? {
            id: 'edit',
            label: 'Edit User',
            icon: Pencil,
            disabled: true,
            hint: 'OAuth',
          }
        : {
            id: 'edit',
            label: 'Edit User',
            icon: Pencil,
            onSelect: openEditDialog,
          },
    ];

    if (isAdmin && !isCurrentUser) {
      actions.push({
        id: 'change-role',
        label: 'Change Role',
        icon: Shield,
        onSelect: openRoleDialog,
      });
    }

    if (isAdmin && !user.emailVerified && !user.hasCredentialAccount) {
      actions.push({
        id: 'resend-invitation',
        label: 'Resend Invitation',
        icon: MailPlus,
        onSelect: handleResendInvitation,
      });
    }

    if (!isOAuthUser) {
      actions.push({
        id: 'reset-password',
        label: 'Reset Password',
        icon: KeyRound,
        onSelect: openResetPasswordDialog,
      });
    }

    if (isAdmin) {
      actions.push({
        id: 'email-logs',
        label: 'Email logs',
        icon: Mail,
        href: `/dashboard/logs?userId=${user.id}&source=emails`,
      });
    }

    actions.push({
      id: 'toggle-status',
      label: isActive ? 'Deactivate' : 'Activate',
      icon: isActive ? Ban : UserCheck,
      onSelect: openStatusDialog,
      separatorBefore: true,
    });

    if (isAdmin) {
      actions.push({
        id: 'delete',
        label: 'Delete User',
        icon: Trash2,
        onSelect: openDeleteDialog,
        destructive: true,
        separatorBefore: true,
      });
    }

    return actions;
  };

  // The dialogs read `selectedIds`: store the ids TableView hands over before opening them.
  const bulkActions: BulkAction[] = [
    {
      id: 'activate',
      label: 'Activate',
      icon: UserCheck,
      onSelect: (ids) => {
        setSelectedIds(ids);
        openBulkActivateDialog();
      },
    },
    {
      id: 'deactivate',
      label: 'Deactivate',
      icon: Ban,
      onSelect: (ids) => {
        setSelectedIds(ids);
        openBulkDeactivateDialog();
      },
    },
    ...(isAdmin
      ? [
          {
            id: 'change-role',
            label: 'Change Role',
            icon: Shield,
            items: USER_ROLES.map((role) => ({
              id: role,
              label: ROLE_LABELS[role],
              onSelect: (ids: string[]) => {
                setSelectedIds(ids);
                openBulkRoleDialog(role);
              },
            })),
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onSelect: (ids: string[]) => {
              setSelectedIds(ids);
              openBulkDeleteDialog();
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title='Users'
        description='Manage your platform users.'
      >
        {isAdmin && (
          <Button onClick={openAddDialog}>
            <UserPlus data-icon="inline-start" strokeWidth={1.5} />
            Add User
          </Button>
        )}
      </PageHeader>

      <TableView
        tableId='users'
        basePath='/dashboard/users'
        query={userTableQuery}
        params={params}
        rows={users}
        total={total}
        totalPages={totalPages}
        columns={USER_COLUMNS}
        hiddenColumns={hiddenColumns}
        filters={USER_FILTERS}
        rowActions={rowActions}
        bulkActions={bulkActions}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        labels={{
          searchPlaceholder: 'Search by name or email...',
          results: ({ from, to, total: count }) =>
            count === 0
              ? 'Showing 0 of 0 users'
              : `Showing ${from}–${to} of ${count} users`,
        }}
      />

      {/* Dialogs */}
      {isAdmin && (
        <AddUserDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      )}

      <EditUserDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentUserId={currentUserId}
      />

      {isAdmin && (
        <ChangeRoleDialog
          user={selectedUser}
          open={roleDialogOpen}
          onOpenChange={setRoleDialogOpen}
        />
      )}

      <ResetPasswordDialog
        user={selectedUser}
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
      />

      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={selectedUser?.status === 'active' ? 'Deactivate User' : 'Activate User'}
        description={
          selectedUser?.status === 'active'
            ? `Are you sure you want to deactivate ${selectedUser?.name}? They will no longer be able to access the platform.`
            : `Are you sure you want to activate ${selectedUser?.name}? They will regain access to the platform.`
        }
        confirmLabel={selectedUser?.status === 'active' ? 'Deactivate' : 'Activate'}
        variant={selectedUser?.status === 'active' ? 'destructive' : 'default'}
        onConfirm={handleToggleStatus}
      />

      {isAdmin && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title='Delete User'
          description={`Are you sure you want to delete ${selectedUser?.name}? This action cannot be undone.`}
          confirmLabel='Delete'
          variant='destructive'
          onConfirm={handleDeleteUser}
        />
      )}

      <ConfirmDialog
        open={bulkActivateDialogOpen}
        onOpenChange={setBulkActivateDialogOpen}
        title='Activate Users'
        description={`Are you sure you want to activate ${selectedIds.length} users?`}
        confirmLabel='Activate All'
        variant='default'
        onConfirm={handleBulkActivate}
      />

      <ConfirmDialog
        open={bulkDeactivateDialogOpen}
        onOpenChange={setBulkDeactivateDialogOpen}
        title='Deactivate Users'
        description={`Are you sure you want to deactivate ${selectedIds.length} users?`}
        confirmLabel='Deactivate All'
        variant='destructive'
        onConfirm={handleBulkDeactivate}
      />

      <ConfirmDialog
        open={bulkRoleDialogOpen}
        onOpenChange={setBulkRoleDialogOpen}
        title='Change Role'
        description={`Are you sure you want to change the role of ${selectedIds.length} users to "${bulkRole}"?`}
        confirmLabel='Change Role'
        variant='default'
        onConfirm={handleBulkChangeRole}
      />

      {isAdmin && (
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title='Delete Users'
          description={`Are you sure you want to delete ${selectedIds.length} users? This action cannot be undone.`}
          confirmLabel='Delete All'
          variant='destructive'
          onConfirm={handleBulkDelete}
        />
      )}
    </>
  );
}
