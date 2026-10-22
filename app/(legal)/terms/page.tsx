import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { getPublicSupportEmail, SUPPORT_EMAIL_NOT_CONFIGURED } from '@/lib/support-email';

export const metadata: Metadata = {
  title: `Terms of Service | ${siteConfig.appName}`,
  description: `Terms that apply when you use ${siteConfig.appName}.`,
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {siteConfig.lastUpdated}</p>
      </header>

      <div className="space-y-9 text-base leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:text-foreground [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:opacity-70">
        <section>
          <h2>1. Acceptance of these terms</h2>
          <p>These Terms of Service govern your use of {siteConfig.appName}, operated by {siteConfig.legalEntityName} (“we,” “us,” or “our”). By creating an account or using the service, you agree to these terms. If you do not agree, do not use the service.</p>
        </section>
        <section>
          <h2>2. Your account and credentials</h2>
          <p>Provide accurate account information and keep your password and sign-in credentials confidential. You are responsible for activity under your account. Tell us promptly if you suspect unauthorized access. We may require email verification and may provide optional two-factor authentication to help secure your account.</p>
        </section>
        <section>
          <h2>3. Acceptable use</h2>
          <p>Do not use the service unlawfully, interfere with its operation or security, attempt unauthorized access, distribute malware, or misuse another person’s account or data. You must have the rights needed to submit any content you upload.</p>
        </section>
        <section>
          <h2>4. Suspension and account closure</h2>
          <p>An administrator may suspend or close an account that violates these terms, creates a security risk, or harms the service or its users. You may ask us to close your account by contacting {supportLink}. Account closure may remove associated profile and account data, subject to applicable retention requirements.</p>
        </section>
        <section>
          <h2>5. Intellectual property</h2>
          <p>The service, its software, design, and original content are owned by {siteConfig.legalEntityName} or its licensors and are protected by applicable intellectual-property laws. These terms give you a limited, revocable right to use the service for its intended purpose. You retain rights to content you provide.</p>
        </section>
        <section>
          <h2>6. Disclaimers</h2>
          <p>To the extent permitted by law, the service is provided “as is” and “as available,” without warranties of any kind. We do not guarantee uninterrupted, secure, or error-free operation.</p>
        </section>
        <section>
          <h2>7. Limitation of liability</h2>
          <p>To the extent permitted by law, {siteConfig.legalEntityName} will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill arising from your use of the service. Nothing in these terms limits liability that cannot legally be limited.</p>
        </section>
        <section>
          <h2>8. Governing law</h2>
          <p>These terms are governed by the laws of {siteConfig.governingLaw}, without regard to conflict-of-law rules, subject to any mandatory protections that apply where you live.</p>
        </section>
        <section>
          <h2>9. Changes and contact</h2>
          <p>We may update these terms and will post the updated version here with a new “Last updated” date. You will be asked to accept the new version when you next sign in. For questions, contact {supportLink}.</p>
        </section>
      </div>
    </article>
  );
}
