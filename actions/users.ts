'use server';

import { randomInt } from 'node:crypto';
import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { auth, getSession } from '@/lib/auth';
import {
  ADMIN_TWO_FACTOR_REQUIRED_MESSAGE,
  assertActiveAdminRemains,
  getAdminAccess,
  getAdminMutationError,
} from '@/lib/admin-access';
import { sendInvitationEmail, sendSecurityNoticeEmail } from '@/lib/email';
import { logActivity } from '@/lib/activity-log';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { reportError } from '@/lib/report-error';
import { getTemporaryPasswordExpiration } from '@/lib/temporary-password';
import { deleteUserRecord } from '@/lib/user-deletion';
import {
  buildUsersWhere,
  getDisplayedAuthProvider,
  userListParamsSchema,
  type UserListParams,
} from '@/lib/user-list-query';
import {
  getInvitationUrl,
  issueUserInvitation,
} from '@/lib/user-invitations';
import {
  addUserSchema,
  changeRoleSchema,
  editUserSchema,
  resetPasswordSchema,
} from '@/validations/users';

// ============================================
// ADD USER ACTION (New Pattern)
// ============================================

type AddUserData = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const addUserAction = async (
  values: z.infer<typeof addUserSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: AddUserData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can add users',
        data: null,
      };
    }

    const { success, data, error } = addUserSchema.safeParse(values);

    if (!success) {
      const firstError = error.issues[0]?.message ?? 'Invalid fields';
      return {
        response: 'error',
        message: firstError,
        data: null,
      };
    }

    const { name, role } = data;
    const email = data.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existingUser) {
      return {
        response: 'error',
        message: 'A user with this email already exists',
        data: null,
      };
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role,
        emailVerified: false,
        status: 'pending',
      },
    });

    try {
      await logActivity(session.user.id, 'profile_update', {
        action: 'user_created',
        targetUserId: newUser.id,
        targetUserName: name,
        targetUserEmail: email,
        role,
      });
    } catch (error) {
      reportError(error, { area: 'users.create-activity' });
    }

    let invitationSent = true;
    try {
      const token = await issueUserInvitation(newUser.id);
      await sendInvitationEmail({
        email: newUser.email,
        name: newUser.name,
        invitedByName: session.user.name,
        url: getInvitationUrl(token),
        userId: newUser.id,
      });
    } catch (error) {
      invitationSent = false;
      reportError(error, { area: 'users.send-invitation' });
    }

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: invitationSent
        ? 'User created and invitation sent'
        : 'User created, but the invitation email could not be sent. Use Resend invitation',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (error) {
    reportError(error, { area: 'users.create' });
    return {
      response: 'error',
      message: 'Failed to create user',
      data: null,
    };
  }
};

export const resendUserInvitationAction = async (
  userId: string,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can resend invitations',
        data: null,
      };
    }

    if (!z.string().min(1).safeParse(userId).success) {
      return { response: 'error', message: 'Invalid user', data: null };
    }

    const rateLimit = await checkRateLimit([
      { key: `invite:user:${userId}`, window: 600, max: 3 },
    ]);
    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        accounts: {
          where: { providerId: 'credential' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return { response: 'error', message: 'User not found', data: null };
    }

    if (user.emailVerified || user.accounts.length > 0) {
      return {
        response: 'error',
        message: 'This user no longer has a pending invitation',
        data: null,
      };
    }

    const token = await issueUserInvitation(user.id);
    await sendInvitationEmail({
      email: user.email,
      name: user.name,
      invitedByName: session.user.name,
      url: getInvitationUrl(token),
      userId: user.id,
    });

    try {
      await logActivity(session.user.id, 'profile_update', {
        action: 'user_invitation_resent',
        targetUserId: user.id,
        targetUserName: user.name,
      });
    } catch (error) {
      reportError(error, { area: 'users.resend-invitation-activity' });
    }

    return {
      response: 'success',
      message: `Invitation resent to ${user.email}`,
      data: null,
    };
  } catch (error) {
    reportError(error, { area: 'users.resend-invitation' });
    return {
      response: 'error',
      message: 'Invitation email could not be sent',
      data: null,
    };
  }
};

// ============================================
// EDIT USER ACTION (New Pattern)
// ============================================

type EditUserData = {
  id: string;
  name: string;
  email: string;
};

export const editUserAction = async (
  userId: string,
  values: z.infer<typeof editUserSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: EditUserData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    // Only admins can edit users
    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can edit users',
        data: null,
      };
    }

    const { success, data, error } = editUserSchema.safeParse(values);

    if (!success) {
      const firstError = error.issues[0]?.message ?? 'Invalid fields';
      return {
        response: 'error',
        message: firstError,
        data: null,
      };
    }

    const { name } = data;
    const email = data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    const emailChanged = email !== user.email.toLowerCase();

    if (emailChanged && user.role === 'admin' && user.id !== session.user.id) {
      return {
        response: 'error',
        message: "Admins can't change another admin's email.",
        data: null,
      };
    }

    // Check if user is OAuth — cannot change email
    if (emailChanged) {
      const oauthAccount = await prisma.account.findFirst({
        where: { userId, providerId: { not: 'credential' } },
      });

      if (oauthAccount) {
        return {
          response: 'error',
          message: 'Cannot change email for OAuth users. Email is managed by the authentication provider.',
          data: null,
        };
      }

      // Check if email is being changed to one that already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          id: { not: userId },
        },
      });

      if (existingUser) {
        return {
          response: 'error',
          message: 'A user with this email already exists',
          data: null,
        };
      }
    }

    const updatedUser = emailChanged
      ? await prisma.$transaction(async (tx) => {
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { name, email, emailVerified: false },
          });
          await tx.session.deleteMany({ where: { userId } });
          return updatedUser;
        })
      : await prisma.user.update({
          where: { id: userId },
          data: { name },
        });

    let message = 'User updated successfully';

    if (emailChanged) {
      try {
        await auth.api.sendVerificationEmail({
          body: { email, callbackURL: '/auth/verify-email' },
        });
        message = 'User updated. A verification code was sent to the new address';
      } catch (error) {
        reportError(error, { area: 'users.verification-email' });
        message = 'User updated, but the verification code could not be sent';
      }
    }

    await logActivity(session.user.id, 'profile_update', {
      action: 'user_edited',
      targetUserId: userId,
      emailVerificationReset: emailChanged,
      changes: {
        name: user.name !== name ? { from: user.name, to: name } : undefined,
        email: emailChanged ? { from: user.email, to: email } : undefined,
      },
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    };
  } catch (error) {
    reportError(error, { area: 'users.update' });
    return {
      response: 'error',
      message: 'Failed to update user',
      data: null,
    };
  }
};

// ============================================
// CHANGE ROLE ACTION (New Pattern)
// ============================================

type ChangeRoleData = {
  userId: string;
  previousRole: string;
  newRole: string;
};

export const changeRoleAction = async (
  userId: string,
  values: z.infer<typeof changeRoleSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ChangeRoleData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can change roles',
        data: null,
      };
    }

    if (userId === session.user.id) {
      return {
        response: 'error',
        message: 'You cannot change your own role',
        data: null,
      };
    }

    const { success, data, error } = changeRoleSchema.safeParse(values);

    if (!success) {
      const firstError = error.issues[0]?.message ?? 'Invalid role';
      return {
        response: 'error',
        message: firstError,
        data: null,
      };
    }

    const { role: newRole } = data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    if (user.role === newRole) {
      return {
        response: 'error',
        message: 'User already has this role',
        data: null,
      };
    }

    const previousRole = user.role;

    await prisma.$transaction(
      async (transaction) => {
        await transaction.user.update({
          where: { id: userId },
          data: { role: newRole },
        });
        await assertActiveAdminRemains(transaction);
      },
      { isolationLevel: 'Serializable' }
    );

    await logActivity(session.user.id, 'profile_update', {
      action: 'role_change',
      targetUserId: userId,
      targetUserName: user.name,
      previousRole,
      newRole,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `Role updated to ${newRole}`,
      data: {
        userId,
        previousRole,
        newRole,
      },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Change role error:', error);
    else reportError(error, { area: 'users.change-role' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to change user role',
      data: null,
    };
  }
};

// ============================================
// DELETE USER ACTION
// ============================================

type DeleteUserData = {
  userId: string;
  userName: string;
};

export const deleteUser = async (
  userId: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: DeleteUserData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can delete users',
        data: null,
      };
    }

    if (session.user.id === userId) {
      return {
        response: 'error',
        message: 'Cannot delete your own account',
        data: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    const deletion = await deleteUserRecord(userId, {
      afterDelete: assertActiveAdminRemains,
    });
    if (!deletion.deleted) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    await logActivity(session.user.id, 'profile_update', {
      action: 'user_deleted',
      targetUserId: userId,
      targetUserName: user.name,
      targetUserEmail: user.email,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `User ${user.name} deleted successfully`,
      data: { userId, userName: user.name },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Delete user error:', error);
    else reportError(error, { area: 'users.delete' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to delete user',
      data: null,
    };
  }
};

// ============================================
// TOGGLE USER STATUS ACTION
// ============================================

type ToggleStatusData = {
  userId: string;
  newStatus: string;
};

export const toggleUserStatus = async (
  userId: string,
  activate: boolean
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ToggleStatusData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can toggle user status',
        data: null,
      };
    }

    if (session.user.id === userId) {
      return {
        response: 'error',
        message: 'Cannot change your own status',
        data: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, status: true },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    const newStatus = activate ? 'active' : 'inactive';

    if (newStatus === 'inactive') {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.user.update({
            where: { id: userId },
            data: { status: newStatus },
          });
          await transaction.session.deleteMany({ where: { userId } });
          await assertActiveAdminRemains(transaction);
        },
        { isolationLevel: 'Serializable' }
      );
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });
    }

    await logActivity(session.user.id, 'profile_update', {
      action: 'status_change',
      targetUserId: userId,
      targetUserName: user.name,
      previousStatus: user.status,
      newStatus,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `User ${activate ? 'activated' : 'deactivated'} successfully`,
      data: { userId, newStatus },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Toggle user status error:', error);
    else reportError(error, { area: 'users.toggle-status' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to change user status',
      data: null,
    };
  }
};

// ============================================
// BULK TOGGLE STATUS ACTION
// ============================================

type BulkToggleStatusData = {
  count: number;
  newStatus: string;
};

export const bulkToggleStatus = async (
  userIds: string[],
  activate: boolean
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: BulkToggleStatusData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can toggle user status',
        data: null,
      };
    }

    if (userIds.includes(session.user.id)) {
      return {
        response: 'error',
        message: 'Cannot change your own status',
        data: null,
      };
    }

    const newStatus = activate ? 'active' : 'inactive';

    if (newStatus === 'inactive') {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.user.updateMany({
            where: { id: { in: userIds } },
            data: { status: newStatus },
          });
          await transaction.session.deleteMany({
            where: { userId: { in: userIds } },
          });
          await assertActiveAdminRemains(transaction);
        },
        { isolationLevel: 'Serializable' }
      );
    } else {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: newStatus },
      });
    }

    await logActivity(session.user.id, 'profile_update', {
      action: 'bulk_status_change',
      targetUserIds: userIds,
      newStatus,
      count: userIds.length,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `${userIds.length} user(s) ${activate ? 'activated' : 'deactivated'} successfully`,
      data: { count: userIds.length, newStatus },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Bulk toggle status error:', error);
    else reportError(error, { area: 'users.bulk-toggle-status' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to change user status',
      data: null,
    };
  }
};

// ============================================
// BULK CHANGE ROLE ACTION
// ============================================

type BulkChangeRoleData = {
  count: number;
  newRole: string;
};

export const bulkChangeRole = async (
  userIds: string[],
  newRole: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: BulkChangeRoleData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can change roles',
        data: null,
      };
    }

    if (userIds.includes(session.user.id)) {
      return {
        response: 'error',
        message: 'You cannot change your own role',
        data: null,
      };
    }

    const parsedRole = changeRoleSchema.safeParse({ role: newRole });
    if (!parsedRole.success) {
      return {
        response: 'error',
        message: parsedRole.error.issues[0]?.message ?? 'Invalid role',
        data: null,
      };
    }

    await prisma.$transaction(
      async (transaction) => {
        await transaction.user.updateMany({
          where: { id: { in: userIds } },
          data: { role: parsedRole.data.role },
        });
        await assertActiveAdminRemains(transaction);
      },
      { isolationLevel: 'Serializable' }
    );

    await logActivity(session.user.id, 'profile_update', {
      action: 'bulk_role_change',
      targetUserIds: userIds,
      newRole,
      count: userIds.length,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `Role updated to ${newRole} for ${userIds.length} user(s)`,
      data: { count: userIds.length, newRole },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Bulk change role error:', error);
    else reportError(error, { area: 'users.bulk-change-role' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to change roles',
      data: null,
    };
  }
};

// ============================================
// BULK DELETE USERS ACTION
// ============================================

type BulkDeleteUsersData = {
  count: number;
};

export const bulkDeleteUsers = async (
  userIds: string[]
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: BulkDeleteUsersData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can delete users',
        data: null,
      };
    }

    if (userIds.includes(session.user.id)) {
      return {
        response: 'error',
        message: 'Cannot delete your own account',
        data: null,
      };
    }

    await prisma.$transaction(
      async (transaction) => {
        await transaction.session.deleteMany({
          where: { userId: { in: userIds } },
        });
        await transaction.account.deleteMany({
          where: { userId: { in: userIds } },
        });
        await transaction.activityLog.deleteMany({
          where: { userId: { in: userIds } },
        });
        await transaction.user.deleteMany({ where: { id: { in: userIds } } });
        await assertActiveAdminRemains(transaction);
      },
      { isolationLevel: 'Serializable' }
    );

    await logActivity(session.user.id, 'profile_update', {
      action: 'bulk_user_deleted',
      targetUserIds: userIds,
      count: userIds.length,
    });

    revalidatePath('/dashboard/users');

    return {
      response: 'success',
      message: `${userIds.length} user(s) deleted successfully`,
      data: { count: userIds.length },
    };
  } catch (error) {
    const adminMutationError = getAdminMutationError(error);
    if (adminMutationError) console.error('Bulk delete users error:', error);
    else reportError(error, { area: 'users.bulk-delete' });
    return {
      response: 'error',
      message: adminMutationError ?? 'Failed to delete users',
      data: null,
    };
  }
};

export type AuthProvider = "email" | "google" | "github";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  provider: AuthProvider;
  createdAt: string;
  lastActive: string;
  emailVerified: boolean;
  hasCredentialAccount: boolean;
}

export interface UserPage {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// RESET PASSWORD ACTION (New Pattern)
// ============================================

type ResetPasswordData = {
  userId: string;
  method: 'email' | 'manual';
  temporaryPassword?: string;
};

export const adminResetPasswordAction = async (
  userId: string,
  values: z.infer<typeof resetPasswordSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ResetPasswordData | null;
}> => {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Only admins can reset passwords',
        data: null,
      };
    }

    const { success, data, error } = resetPasswordSchema.safeParse(values);

    if (!success) {
      const firstError = error.issues[0]?.message ?? 'Invalid method';
      return {
        response: 'error',
        message: firstError,
        data: null,
      };
    }

    const { method } = data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    if (method === 'email') {
      await auth.api.requestPasswordResetEmailOTP({
        body: {
          email: user.email,
        },
        headers: await headers(),
      });

      await logActivity(session.user.id, 'profile_update', {
        action: 'password_reset_requested',
        targetUserId: userId,
        targetUserName: user.name,
        method: 'email',
      });

      return {
        response: 'success',
        message: `Password reset email sent to ${user.email}`,
        data: {
          userId,
          method: 'email',
        },
      };
    }

    if (user.role === 'admin') {
      return {
        response: 'error',
        message: "Admins can only reset another admin's password by email link",
        data: null,
      };
    }

    if (session.user.id === userId) {
      return {
        response: 'error',
        message: 'Use the password change option in your profile to reset your own password',
        data: null,
      };
    }

    const credentialAccount = await prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
      select: { id: true },
    });

    if (!credentialAccount) {
      return {
        response: 'error',
        message: 'This user has no password account. They can only sign in with Google or GitHub.',
        data: null,
      };
    }

    const temporaryPassword = generateTemporaryPassword();
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(temporaryPassword);
    const temporaryPasswordExpiresAt = getTemporaryPasswordExpiration();
    await prisma.$transaction([
      prisma.account.update({
        where: { id: credentialAccount.id },
        data: { password: hash },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          mustChangePassword: true,
          temporaryPasswordExpiresAt,
        },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    await logActivity(session.user.id, 'profile_update', {
      action: 'password_reset_manual',
      targetUserId: userId,
      targetUserName: user.name,
      method: 'manual',
    });

    try {
      await sendSecurityNoticeEmail({
        to: user.email,
        userName: user.name,
        event: 'temporary-password-created',
        occurredAt: new Date(),
        userId: user.id,
      });
    } catch (error) {
      reportError(error, { area: 'users.temporary-password-notice' });
    }

    return {
      response: 'success',
      message: 'Temporary password generated',
      data: {
        userId,
        method: 'manual',
        temporaryPassword,
      },
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Reset password error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Failed to reset password',
        data: null,
      };
    }
    reportError(error, { area: 'users.reset-password' });
    return {
      response: 'error',
      message: 'Failed to reset password',
      data: null,
    };
  }
};

// Helper to generate a temporary password
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const chars = uppercase + lowercase + numbers;
  const password = [
    uppercase[randomInt(uppercase.length)],
    numbers[randomInt(numbers.length)],
  ];

  while (password.length < 12) {
    password.push(chars[randomInt(chars.length)]);
  }

  for (let index = password.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  return password.join('');
}

export async function getUsers(params: UserListParams): Promise<{
  response: 'success' | 'error';
  message: string;
  data: UserPage | null;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Unauthorized',
        data: null,
      };
    }

    const parsedParams = userListParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        response: 'error',
        message: 'Invalid user list parameters',
        data: null,
      };
    }

    const where = buildUsersWhere(parsedParams.data);
    const [total, usersData] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (parsedParams.data.page - 1) * parsedParams.data.pageSize,
        take: parsedParams.data.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          accounts: {
            select: {
              providerId: true,
            },
          },
          activityLogs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const users = usersData.map((user) => {
      const provider = getDisplayedAuthProvider(
        user.accounts.map((account) => account.providerId),
      );

      // Use status from database, fallback to pending if email not verified
      const status = !user.emailVerified ? "pending" : user.status;

      // Determine last active from activity logs
      let lastActive = "Never";
      if (user.activityLogs.length > 0) {
        const lastActivity = user.activityLogs[0];
        const diffMs = now.getTime() - lastActivity.createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastActive = "Today";
        } else if (diffDays === 1) {
          lastActive = "Yesterday";
        } else if (diffDays < 7) {
          lastActive = `${diffDays} days ago`;
        } else if (diffDays < 14) {
          lastActive = "1 week ago";
        } else if (diffDays < 30) {
          lastActive = `${Math.floor(diffDays / 7)} weeks ago`;
        } else {
          lastActive = `${Math.floor(diffDays / 30)} months ago`;
        }
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status,
        provider,
        createdAt: user.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        lastActive,
        emailVerified: user.emailVerified,
        hasCredentialAccount: user.accounts.some(
          (account) => account.providerId === 'credential',
        ),
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / parsedParams.data.pageSize));

    return {
      response: 'success',
      message: 'Users fetched successfully',
      data: {
        users,
        total,
        page: Math.min(parsedParams.data.page, totalPages),
        pageSize: parsedParams.data.pageSize,
        totalPages,
      },
    };
  } catch (error) {
    reportError(error, { area: "users.list" });
    return {
      response: 'error',
      message: 'Failed to fetch users',
      data: null,
    };
  }
}
