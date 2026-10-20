'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { registerSchema } from '@/validations/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { TERMS_ACCEPTANCE_HEADER } from '@/lib/terms-acceptance';
import { reportError } from '@/lib/report-error';
import { prisma } from '@/lib/prisma';
import { EmailDeliveryError } from '@/lib/email';

type SignUpData = {
  email: string;
  emailSent: boolean;
};

export const signUpAction = async (
  values: z.infer<typeof registerSchema>,
  captchaToken?: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: SignUpData | null;
}> => {
  try {
    const { success, data } = registerSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const { name, email, password, acceptTerms } = data;
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

    const requestHeaders = new Headers(await headers());
    requestHeaders.set(TERMS_ACCEPTANCE_HEADER, String(acceptTerms));

    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: requestHeaders,
    });

    const createdUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    let emailSent = true;

    if (createdUser && createdUser.id === result.user.id) {
      try {
        await auth.api.sendVerificationEmail({
          body: { email },
          headers: requestHeaders,
        });
      } catch (error) {
        if (error instanceof EmailDeliveryError) {
          emailSent = false;
        } else {
          throw error;
        }
      }
    }

    return {
      response: 'success',
      message: 'Account created successfully. Please check your email to verify your account.',
      data: { email, emailSent },
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Sign up error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Registration failed',
        data: null,
      };
    }
    reportError(error, { area: 'auth.sign-up' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};
