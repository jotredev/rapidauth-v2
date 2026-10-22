// Sends one verification email through lib/email.ts in its own process, so the
// environment (read once at import time) is exactly what the caller passed in.
// Prints the delivery error code on failure, or "sent" on success.
import { EmailDeliveryError, sendVerificationCodeEmail } from '../../../lib/email';

try {
  await sendVerificationCodeEmail({
    email: process.env.E2E_MAIL_TO ?? '',
    name: 'Mailpit User',
    code: process.env.E2E_MAIL_CODE ?? '',
  });
  console.log('sent');
} catch (error) {
  console.log(error instanceof EmailDeliveryError ? `error:${error.errorCode}` : 'error:other');
}
process.exit(0);
