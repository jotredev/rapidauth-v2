'use server';

import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/report-error';

// ============================================
// REVOKE SESSION ACTION
// ============================================

type RevokeSessionData = {
  sessionId: string;
};

export const revokeSession = async (
  sessionId: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: RevokeSessionData | null;
}> => {
  try {
    const currentSession = await getSession();

    if (!currentSession?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      return {
        response: 'error',
        message: 'Session not found',
        data: null,
      };
    }

    if (session.userId !== currentSession.user.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    revalidatePath('/dashboard/profile');

    return {
      response: 'success',
      message: 'Session revoked successfully',
      data: { sessionId },
    };
  } catch (error) {
    reportError(error, { area: 'sessions.revoke' });
    return {
      response: 'error',
      message: 'Failed to revoke session',
      data: null,
    };
  }
};

// ============================================
// REVOKE ALL OTHER SESSIONS ACTION
// ============================================

type RevokeAllSessionsData = {
  count: number;
};

export const revokeAllOtherSessions = async (): Promise<{
  response: 'success' | 'error';
  message: string;
  data: RevokeAllSessionsData | null;
}> => {
  try {
    const currentSession = await getSession();

    if (!currentSession?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const result = await prisma.session.deleteMany({
      where: {
        userId: currentSession.user.id,
        id: { not: currentSession.session.id },
      },
    });

    revalidatePath('/dashboard/profile');

    return {
      response: 'success',
      message: `${result.count} session(s) revoked successfully`,
      data: { count: result.count },
    };
  } catch (error) {
    reportError(error, { area: 'sessions.revoke-all' });
    return {
      response: 'error',
      message: 'Failed to revoke sessions',
      data: null,
    };
  }
};

// ============================================
// REVOKE SELECTED SESSIONS ACTION
// ============================================

const revokeSessionsSchema = z.array(z.string().min(1)).min(1).max(100);

export const revokeSessions = async (
  ids: string[]
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: RevokeAllSessionsData | null;
}> => {
  try {
    const currentSession = await getSession();

    if (!currentSession?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const parsedIds = revokeSessionsSchema.safeParse(ids);

    if (!parsedIds.success) {
      return {
        response: 'error',
        message: 'Invalid session ids',
        data: null,
      };
    }

    // Only the signed-in user's own sessions, and never the one in use.
    const result = await prisma.session.deleteMany({
      where: {
        id: { in: parsedIds.data, not: currentSession.session.id },
        userId: currentSession.user.id,
      },
    });

    revalidatePath('/dashboard/profile');

    return {
      response: 'success',
      message: `${result.count} session(s) revoked successfully`,
      data: { count: result.count },
    };
  } catch (error) {
    reportError(error, { area: 'sessions.revoke-selected' });
    return {
      response: 'error',
      message: 'Failed to revoke sessions',
      data: null,
    };
  }
};
