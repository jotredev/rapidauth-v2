import { betterAuth } from "better-auth";
import {
  addOAuthServerContext,
  APIError,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/config/site";
import { getBetterAuthIpAddressOptions } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import {
  sendAccountDeletedEmail,
  sendPasswordResetCodeEmail,
  sendSecurityNoticeEmail,
  sendVerificationCodeEmail,
} from "@/lib/email";
import { USER_INVITATION_PREFIX } from "@/lib/user-invitation-token";
import { VERIFICATION_CODE_POLICY } from "@/lib/verification-code-policy";
import { deleteStoredAvatar } from "@/lib/storage/avatar";
import { createSocialProviders } from "@/lib/social-providers";
import {
  resolveTermsAcceptance,
  TERMS_ACCEPTANCE_HEADER,
} from "@/lib/terms-acceptance";
import {
  hasExpiredTemporaryPassword,
  TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
} from "@/lib/temporary-password";
import { cookies, headers } from "next/headers";

// Keep auth email links on the configured application origin.
const baseURL = process.env.BETTER_AUTH_URL;

if (!baseURL) {
  throw new Error(
    "BETTER_AUTH_URL is required because auth email links would use the request Host without it."
  );
}

let parsedBaseURL: URL;

try {
  parsedBaseURL = new URL(baseURL);
} catch {
  throw new Error("BETTER_AUTH_URL must be a valid HTTP or HTTPS URL.");
}

if (parsedBaseURL.protocol !== "http:" && parsedBaseURL.protocol !== "https:") {
  throw new Error("BETTER_AUTH_URL must be a valid HTTP or HTTPS URL.");
}

export const auth = betterAuth({
  baseURL,
  advanced: {
    ipAddress: getBetterAuthIpAddressOptions(),
  },
  rateLimit: { enabled: true, storage: "database" },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-in/social") return;

      const additionalData = context.body?.additionalData as
        | Record<string, unknown>
        | undefined;

      if (
        context.body?.requestSignUp === true &&
        additionalData?.termsAccepted === true
      ) {
        await addOAuthServerContext({ termsAccepted: true });
      }
    }),
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId === "credential") return;

          const user = await prisma.user.findUnique({
            where: { id: account.userId },
            select: { emailVerified: true },
          });

          if (!user || user.emailVerified) return;

          // OAuth proves email ownership; the prior unverified password is not trustworthy.
          const removedCredentials = await prisma.account.deleteMany({
            where: {
              userId: account.userId,
              providerId: "credential",
            },
          });

          if (removedCredentials.count > 0) {
            await prisma.session.deleteMany({
              where: { userId: account.userId },
            });

            try {
              await prisma.activityLog.create({
                data: {
                  userId: account.userId,
                  action: "oauth_link",
                  details: JSON.stringify({
                    provider: account.providerId,
                    removedUnverifiedPassword: true,
                  }),
                  ipAddress: "unknown",
                  userAgent: "unknown",
                },
              });
            } catch (error) {
              reportError(error, { area: "auth.oauth-link-activity" });
            }
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // All sign-in paths create a session, making this the single enforcement point.
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
              status: true,
              mustChangePassword: true,
              temporaryPasswordExpiresAt: true,
            },
          });

          if (user?.status === "inactive") {
            throw new APIError("FORBIDDEN", {
              message: "This account has been deactivated.",
            });
          }

          if (user && hasExpiredTemporaryPassword(user)) {
            throw new APIError("FORBIDDEN", {
              message: TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
            });
          }
        },
        after: async (session) => {
          // Log login activity when a new session is created
          try {
            await prisma.activityLog.create({
              data: {
                userId: session.userId,
                action: "login",
                details: null,
                ipAddress: session.ipAddress || "unknown",
                userAgent: session.userAgent || "unknown",
              },
            });
          } catch (error) {
            reportError(error, { area: "auth.login-activity" });
          }
        },
      },
    },
    user: {
      create: {
        before: async (user, context) => {
          let source: "email" | "oauth" | null = null;
          let accepted: unknown;

          if (context?.path === "/sign-up/email") {
            source = "email";
            accepted =
              (context.request?.headers.get(TERMS_ACCEPTANCE_HEADER) ??
                context.headers?.get(TERMS_ACCEPTANCE_HEADER)) === "true";
          } else if (context?.path?.startsWith("/callback/")) {
            source = "oauth";
            accepted = (await getOAuthState())?.serverContext?.termsAccepted;
          }

          const acceptance = resolveTermsAcceptance({ source, accepted });
          if (!acceptance.termsAcceptedAt) return;

          return {
            data: {
              ...user,
              ...acceptance,
            },
          };
        },
        after: async (user) => {
          // Log registration activity when a new user is created
          try {
            await prisma.activityLog.create({
              data: {
                userId: user.id,
                action: "register",
                details: null,
                ipAddress: "unknown",
                userAgent: "unknown",
              },
            });
          } catch (error) {
            reportError(error, { area: "auth.registration-activity" });
          }

          if (
            user.termsAcceptedAt &&
            user.termsVersion === siteConfig.termsVersion
          ) {
            try {
              await prisma.activityLog.create({
                data: {
                  userId: user.id,
                  action: "terms_accepted",
                  details: JSON.stringify({
                    version: siteConfig.termsVersion,
                  }),
                  ipAddress: "unknown",
                  userAgent: "unknown",
                },
              });
            } catch (error) {
              reportError(error, { area: "auth.terms-activity" });
            }
          }
        },
      },
    },
  },
  socialProviders: createSocialProviders(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });

      if (dbUser?.status === "pending") {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: "active",
            emailVerified: true,
          },
        });

        await prisma.verification.deleteMany({
          where: {
            value: user.id,
            identifier: {
              startsWith: USER_INVITATION_PREFIX,
            },
          },
        });

        try {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: "profile_update",
              details: JSON.stringify({
                action: "invitation_completed_by_password_reset",
              }),
              ipAddress: "unknown",
              userAgent: "unknown",
            },
          });
        } catch (error) {
          reportError(error, {
            area: "auth.invitation-completed-by-password-reset-activity",
          });
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
        },
      });

      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "password_change",
            details: null,
            ipAddress: "unknown",
            userAgent: "unknown",
          },
        });
      } catch (error) {
        reportError(error, { area: "auth.password-reset-activity" });
      }

      try {
        await sendSecurityNoticeEmail({
          to: user.email,
          userName: user.name,
          event: 'password-reset',
          occurredAt: new Date(),
          userId: user.id,
        });
      } catch (error) {
        reportError(error, { area: 'auth.password-reset-notice' });
      }
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    beforeEmailVerification: async (user) => {
      let status = (user as { status?: string }).status;
      if (!status && user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { status: true },
        });
        status = dbUser?.status;
      }
      if (status === 'pending') {
        throw new APIError('FORBIDDEN', {
          message: 'Accept your invitation from the email we sent you.',
        });
      }
    },
    afterEmailVerification: async (user) => {
      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "email_verified",
            details: null,
            ipAddress: "unknown",
            userAgent: "unknown",
          },
        });
      } catch (error) {
        reportError(error, { area: "auth.email-verification-activity" });
      }
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const currentUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        if (currentUser?.role !== "admin") return;

        const otherActiveAdmins = await prisma.user.count({
          where: { role: "admin", status: "active", id: { not: user.id } },
        });

        if (otherActiveAdmins === 0) {
          throw new APIError("FORBIDDEN", {
            message: "You are the last administrator. Add another active administrator before deleting this account.",
          });
        }
      },
      afterDelete: async (user) => {
        try {
          await deleteStoredAvatar(user.image, user.id);
        } catch (error) {
          reportError(error, { area: "auth.delete-account-avatar" });
        }

        try {
          await prisma.verification.deleteMany({
            where: { OR: [{ value: user.id }, { identifier: user.email }] },
          });
        } catch (error) {
          reportError(error, { area: "auth.delete-account-verifications" });
        }

        try {
          await sendAccountDeletedEmail({
            email: user.email,
            name: user.name,
            deletedAt: new Date().toLocaleString("en-US", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "UTC",
            }) + " UTC",
          });
        } catch (error) {
          reportError(error, { area: "auth.delete-account-notice" });
        }
      },
    },
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      termsAcceptedAt: {
        type: "date",
        required: false,
        input: false,
      },
      termsVersion: {
        type: "string",
        required: false,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      temporaryPasswordExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "RapidAuth",
    }),
    emailOTP({
      otpLength: VERIFICATION_CODE_POLICY.length,
      expiresIn: VERIFICATION_CODE_POLICY.expiresInSeconds,
      allowedAttempts: VERIFICATION_CODE_POLICY.maxAttempts,
      storeOTP: 'hashed',
      disableSignUp: true,
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === 'email-verification') {
          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, status: true },
          });
          if (!user || user.status === 'pending') {
            return;
          }
          await sendVerificationCodeEmail({
            email,
            name: user.name,
            code: otp,
            userId: user.id,
          });
          return;
        }
        if (type === 'forget-password') {
          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true },
          });
          if (!user) {
            return;
          }
          await sendPasswordResetCodeEmail({
            email,
            name: user.name,
            code: otp,
            userId: user.id,
          });
          return;
        }
      },
    }),
    nextCookies(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export async function getSession() {
  const requestHeaders = new Headers(await headers());
  // Better Auth 1.7 can rotate the session inside an action (for example, during TOTP setup verification); cookies() reflects the new cookie.
  const cookieHeader = (await cookies()).toString();

  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  } else {
    requestHeaders.delete("cookie");
  }

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  return session;
}
