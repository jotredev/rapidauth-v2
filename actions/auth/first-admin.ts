'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/validations/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { reportError } from '@/lib/report-error';
import { hasAdminUser, isFirstRunWindowOpen } from '@/lib/first-run-admin';
import {
  FIRST_RUN_ADMIN_EXISTS_MESSAGE,
  FIRST_RUN_CLOSED_MESSAGE,
} from '@/lib/first-run-admin-messages';

class AdminAlreadyExistsError extends Error {
  constructor() {
    super(FIRST_RUN_ADMIN_EXISTS_MESSAGE);
    this.name = 'AdminAlreadyExistsError';
  }
}

export const createFirstAdminAction = async (
  values: z.infer<typeof registerSchema>,
  captchaToken?: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const { success, data } = registerSchema.safeParse(values);

    if (!success) {
      return { response: 'error', message: 'Invalid fields', data: null };
    }

    if (await hasAdminUser()) {
      return { response: 'error', message: FIRST_RUN_ADMIN_EXISTS_MESSAGE, data: null };
    }

    if (!isFirstRunWindowOpen()) {
      return { response: 'error', message: FIRST_RUN_CLOSED_MESSAGE, data: null };
    }

    const { name, email, password } = data;
    const clientIp = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const ipRateLimit = clientIp
      ? await checkRateLimit([
          { key: `signup:ip:${clientIp}`, window: 3600, max: 5 },
        ])
      : null;

    if (ipRateLimit?.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${ipRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    if (!(await verifyTurnstile(captchaToken, 'signup'))) {
      return {
        response: 'error',
        message: 'Captcha verification failed. Please try again.',
        data: null,
      };
    }

    const emailRateLimit = await checkRateLimit([
      { key: `signup:email:${hashKey(normalizedEmail)}`, window: 3600, max: 3 },
    ]);

    if (emailRateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${emailRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    const context = await auth.$context;
    const passwordHash = await context.password.hash(password);
    const acceptedAt = new Date();

    // Serializable: two people submitting at once cannot both pass the check below.
    await prisma.$transaction(
      async (transaction) => {
        if (await hasAdminUser(transaction)) throw new AdminAlreadyExistsError();

        const user = await transaction.user.create({
          data: {
            name,
            email: normalizedEmail,
            emailVerified: true,
            role: 'admin',
            termsAcceptedAt: acceptedAt,
            termsVersion: siteConfig.termsVersion,
          },
        });

        await transaction.account.create({
          data: {
            accountId: user.id,
            providerId: 'credential',
            password: passwordHash,
            userId: user.id,
          },
        });

        await transaction.activityLog.createMany({
          data: [
            {
              userId: user.id,
              action: 'register',
              details: JSON.stringify({ method: 'first-run', role: 'admin' }),
              ipAddress: clientIp ?? 'unknown',
              userAgent: 'unknown',
            },
            {
              userId: user.id,
              action: 'terms_accepted',
              details: JSON.stringify({ version: siteConfig.termsVersion }),
              ipAddress: clientIp ?? 'unknown',
              userAgent: 'unknown',
            },
          ],
        });
      },
      { isolationLevel: 'Serializable' }
    );

    return {
      response: 'success',
      message: 'Administrator account created. You can now sign in.',
      data: null,
    };
  } catch (error) {
    if (error instanceof AdminAlreadyExistsError) {
      return { response: 'error', message: FIRST_RUN_ADMIN_EXISTS_MESSAGE, data: null };
    }

    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : null;

    // P2034: a concurrent attempt won the race. P2002: the email belongs to a non-admin user.
    if (code === 'P2034' || code === 'P2002') {
      return {
        response: 'error',
        message: 'Could not create the administrator account. Please try again.',
        data: null,
      };
    }

    reportError(error, { area: 'auth.first-admin' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};
