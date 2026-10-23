import "server-only";
import { TEMPORARY_PASSWORD_EXPIRED_MESSAGE } from "@/lib/temporary-password";

const LOGIN_NOTICES = {
  "invitation-accepted":
    "Invitation accepted. You can now sign in with your password.",
  "temporary-password-expired": TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
  "password-reset": "Password reset. Sign in with your new password.",
  "email-verified": "Email verified. Sign in with your password.",
  "admin-created": "Administrator account created. Sign in to continue.",
} as const;

export function getLoginNotice(
  notice: string | string[] | undefined,
): string | undefined {
  if (typeof notice !== "string") return undefined;
  if (!Object.hasOwn(LOGIN_NOTICES, notice)) return undefined;

  return LOGIN_NOTICES[notice as keyof typeof LOGIN_NOTICES];
}
