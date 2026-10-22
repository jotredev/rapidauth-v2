import Link from 'next/link';
import { siteConfig } from '@/config/site';

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-5 sm:px-8">
          <Link
            href="/"
            aria-label={`Return to ${siteConfig.appName} home`}
            className="text-[17px] font-normal transition-opacity hover:opacity-70"
          >
            {siteConfig.appName}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </main>
      <footer className="border-t border-border/70">
        <nav
          aria-label="Legal documents"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-7 text-sm text-muted-foreground sm:px-8"
        >
          <Link className="transition-colors hover:text-foreground" href="/terms">
            Terms of Service
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/support">
            Support
          </Link>
          <span className="ml-auto text-xs">&copy; {new Date().getFullYear()} {siteConfig.appName}</span>
        </nav>
      </footer>
    </div>
  );
}
