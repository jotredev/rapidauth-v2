import type { Metadata } from 'next';
import { connection } from 'next/server';
import { siteConfig } from '@/config/site';
import { getEnv } from '@/lib/env';
import { getPublicSupportEmail, SUPPORT_EMAIL_NOT_CONFIGURED } from '@/lib/support-email';

export const metadata: Metadata = {
  title: `Privacy Policy | ${siteConfig.appName}`,
  description: `How ${siteConfig.appName} collects, uses, and protects personal information.`,
};

export default async function PrivacyPage() {
  // Read Google/GitHub credentials on each request, not at build time.
  await connection();
  const { google, github } = getEnv().config;
  const googleEnabled = google.enabled;
  const githubEnabled = github.enabled;
  const supportEmail = getPublicSupportEmail();
  const supportLink = supportEmail ? (
    <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
  ) : (
    SUPPORT_EMAIL_NOT_CONFIGURED
  );

  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-border pb-8">
        <p className="text-sm font-normal text-muted-foreground">Legal</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {siteConfig.lastUpdated}</p>
      </header>

      <div className="space-y-9 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:text-foreground [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:opacity-70">
        <section>
          <h2>1. Who we are and what this covers</h2>
          <p>{siteConfig.legalEntityName} (“we,” “us,” or “our”) operates {siteConfig.appName}. This policy explains personal information processed when you create an account, use the dashboard, or contact us. The service is intended for account management and authentication.</p>
        </section>
        <section>
          <h2>2. Information we process</h2>
          <ul className="list-disc space-y-2 pl-6 marker:text-foreground/50">
            <li><strong className="text-foreground">Account details:</strong> name, email address, password stored as a cryptographic hash for password-based accounts, email-verification state, role, and account status.</li>
            <li><strong className="text-foreground">Optional profile image:</strong> an avatar you choose to upload. It is stored with the file-storage provider configured for the service, and its public URL can be accessed by anyone who has that URL.</li>
            <li><strong className="text-foreground">Sessions:</strong> session identifier and expiry, plus IP address and browser user-agent when available. Sessions expire after 7 days.</li>
            <li><strong className="text-foreground">Activity records:</strong> account activity events, with IP address and browser user-agent when available.</li>
            <li><strong className="text-foreground">Two-factor authentication:</strong> an authenticator secret and backup codes when you enable two-factor authentication.</li>
            <li><strong className="text-foreground">Abuse-prevention records:</strong> rate-limit counters and keys used to limit repeated attempts.</li>
            <li><strong className="text-foreground">Verification and recovery tokens:</strong> temporary tokens used for email verification and password recovery.</li>
          </ul>
        </section>
        <section>
          <h2>3. How we use information</h2>
          <p>We use this information to provide and secure account access, verify email addresses, support password recovery and optional two-factor authentication, display your profile, limit abusive requests, maintain activity records, and respond to support requests.</p>
        </section>
        <section>
          <h2>4. Service providers</h2>
          <p>We share information with service providers only as needed to operate the app:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-foreground/50">
            <li>Cloudflare Turnstile processes registration and password-recovery requests to help detect automated abuse.</li>
            <li>Resend processes email addresses and message content to deliver verification and recovery emails.</li>
            <li>Our database provider stores account, session, security, and activity records.</li>
            <li>Our hosting provider processes requests and stores or serves the application and uploaded files.</li>
            <li>The configured file-storage provider stores avatars and serves them from their public URLs.</li>
            {googleEnabled && <li>Google processes information you provide when you choose Google sign-in, under Google’s privacy terms.</li>}
            {githubEnabled && <li>GitHub processes information you provide when you choose GitHub sign-in, under GitHub’s privacy terms.</li>}
          </ul>
        </section>
        <section>
          <h2>5. Cookies and local storage</h2>
          <p>Better Auth uses essential cookies to keep you signed in and protect your session. The app stores your theme preference in browser localStorage. We do not use analytics or advertising cookies.</p>
        </section>
        <section>
          <h2>6. Retention</h2>
          <p>We keep account and related records while your account is active and for as long as needed to operate the service, protect it, resolve disputes, or meet legal obligations. Verification and recovery tokens are temporary and expire. When you delete your account, your profile and related records are removed and your stored avatar is deleted.</p>
        </section>
        <section>
          <h2>7. Security</h2>
          <p>We use measures intended to protect information, including password hashing, session controls, access checks, rate limits, and optional two-factor authentication. No internet service or storage system can be guaranteed completely secure.</p>
        </section>
        <section>
          <h2>8. Your choices and rights</h2>
          <p>You can view and edit profile information from the dashboard. Delete your account from Profile → Security; your profile data, sessions, connected accounts, two-factor settings, activity history, and stored avatar are deleted, and we send you an email notice. To request a copy of your personal data, email {supportLink}. Depending on where you live, you may have additional privacy rights under local law.</p>
        </section>
        <section>
          <h2>9. Children</h2>
          <p>{siteConfig.appName} is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us so we can review it.</p>
        </section>
        <section>
          <h2>10. Changes and contact</h2>
          <p>We may update this policy and will post changes here with a new “Last updated” date. Questions or requests can be sent to {supportLink}.</p>
        </section>
      </div>
    </article>
  );
}
