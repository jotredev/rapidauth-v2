import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import {
  getPublicSupportEmail,
  SUPPORT_EMAIL_NOT_CONFIGURED,
} from '@/lib/support-email';

export const metadata: Metadata = {
  title: `Support | ${siteConfig.appName}`,
  description: `Get help and support for ${siteConfig.appName}.`,
};

export default function SupportPage() {
  const supportEmail = getPublicSupportEmail();

  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-sm font-normal text-muted-foreground">Help</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Support</h1>
        <p className="text-sm text-muted-foreground">Need help with your account or have questions?</p>
      </header>

      <div className="space-y-9 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:text-foreground [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:opacity-70">
        <section>
          <h2>Did not receive an email?</h2>
          <p>
            If a verification link or password reset email does not arrive, please check your spam or junk folder. Wait a few minutes before requesting a new email, and verify that the email address you entered was spelled correctly.
          </p>
        </section>

        <section>
          <h2>How to contact support</h2>
          <p>
            If you still need help, write to us from the email address associated with your account. Describe what you were trying to do and include any relevant details or error messages.
          </p>
          <p className="font-semibold text-foreground">
            Never include account passwords, temporary verification codes, or two-factor backup codes in your message.
          </p>
          <p>
            You can reach our support team at{' '}
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            ) : (
              <span>{SUPPORT_EMAIL_NOT_CONFIGURED}</span>
            )}
            .
          </p>
        </section>
      </div>
    </article>
  );
}
