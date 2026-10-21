'use client';

import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/dashboard';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { User } from '@/actions/users';
import { cn } from '@/lib/utils';
import type { UserListParams } from '@/lib/user-list-query';
import { useUsersFilters, useUserDialogs, useUserActions } from './hooks';
import { SearchAndFilters } from './search-and-filters';
import { ActiveFilters } from './active-filters';
import { UsersTable } from './users-table';
import { BulkActionsBar } from './bulk-actions-bar';
import { AddUserDialog } from './add-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { ChangeRoleDialog } from './change-role-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UsersPagination } from './users-pagination';
import { UserPlus } from 'lucide-react';

interface UsersContentProps {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  initialParams: UserListParams;
  isAdmin?: boolean;
  currentUserId: string;
}

export function UsersContent({
  users,
  total,
  page,
  pageSize,
  totalPages,
  initialParams,
  isAdmin = true,
  currentUserId,
}: UsersContentProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    activeFilterCount,
    removeFilter,
    clearAllFilters,
    goToPage,
    getPageHref,
    isPending,
  } = useUsersFilters({ initialParams, onParamsChange: clearSelection });

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

  return (
    <>
      <PageHeader
        title='Users'
        description='Manage your platform users.'
        dateRangeOptions={[]}
      >
        {isAdmin && (
          <Button onClick={openAddDialog}>
            <UserPlus data-icon="inline-start" strokeWidth={1.5} />
            Add User
          </Button>
        )}
      </PageHeader>

      <div className='dark:border dark:border-border bg-card'>
        <div className='flex flex-col gap-3 p-4 dark:border-b dark:border-border'>
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            activeFilterCount={activeFilterCount}
          />

          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              {(searchQuery || activeFilterCount > 0) && (
                <ActiveFilters
                  filters={filters}
                  onRemoveFilter={removeFilter}
                  onClearAll={clearAllFilters}
                />
              )}
            </div>
            <p className='text-sm text-muted-foreground' aria-live='polite'>
              {total === 0
                ? 'Showing 0 of 0 users'
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                    page * pageSize,
                    total,
                  )} of ${total} users`}
            </p>
          </div>
        </div>

        <div
          className={cn('transition-opacity', isPending && 'opacity-50')}
          aria-busy={isPending}
        >
          <UsersTable
            users={users}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onEdit={openEditDialog}
            onDelete={openDeleteDialog}
            onChangeRole={openRoleDialog}
            onResetPassword={openResetPasswordDialog}
            onResendInvitation={handleResendInvitation}
            onToggleStatus={openStatusDialog}
          />
        </div>

        {totalPages > 1 && (
          <>
            <Separator />
            <UsersPagination
              page={page}
              totalPages={totalPages}
              isPending={isPending}
              getPageHref={getPageHref}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={clearSelection}
          onBulkActivate={openBulkActivateDialog}
          onBulkDeactivate={openBulkDeactivateDialog}
          onBulkChangeRole={openBulkRoleDialog}
          onBulkDelete={openBulkDeleteDialog}
          isAdmin={isAdmin}
        />
      )}

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
