import type { ProjectAnswers } from '../template/metadata';

export interface ProjectText extends ProjectAnswers {
  description: string;
}

/** Short README for a new project: what it is, how to start, where the documentation is. */
export function renderReadme(project: ProjectText): string {
  const lines = [`# ${project.name}`, ''];
  if (project.description.trim()) lines.push(project.description.trim(), '');
  lines.push(
    '## Getting started',
    '',
    'You need [Bun](https://bun.sh) and, for the local database, Docker.',
    '',
    '```bash',
    'bun install',
    '(cd docker && docker compose up -d db mailpit)   # local PostgreSQL and a Mailpit inbox',
    'bun dev                                          # creates .env with local values on the first run',
    '```',
    '',
    'Open http://localhost:3000. To prepare production settings, run `bun run setup:prod`.',
    '',
    '## Documentation',
    '',
    '- [English](docs/en/README.md)',
    '- [Español](docs/es/README.md)',
    '',
    '## Commands',
    '',
    '```bash',
    'bun dev          # development',
    'bun run build    # production build',
    'bun run lint     # lint (zero warnings allowed)',
    'bun run test     # tests',
    '```',
    '',
  );
  return lines.join('\n');
}

/** `app/page.tsx`: the same server logic as the template, which renders the neutral landing. */
export function renderLandingPage(): string {
  return `import { redirectToFirstRunIfNoAdmin } from "@/lib/first-run-admin";
import { LandingContent } from "@/components/landing-content";
import { getSession } from "@/lib/auth";

export default async function Home() {
  await redirectToFirstRunIfNoAdmin();
  const session = await getSession();

  const user = session ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? undefined,
  } : null;

  return <LandingContent user={user} />;
}
`;
}

/** `components/landing-content.tsx`: a neutral page with the project name and description. */
export function renderLandingContent(project: ProjectText): string {
  const description = project.description.trim();
  const paragraph = description
    ? `
      <p className="max-w-xl text-lg text-muted-foreground">{DESCRIPTION}</p>`
    : '';
  return `import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

interface LandingUser {
  name: string;
  email: string;
  image?: string;
}

${description ? `const DESCRIPTION = ${JSON.stringify(description)};\n\n` : ''}export function LandingContent({ user }: { user?: LandingUser | null }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{siteConfig.appName}</h1>${paragraph}
      <div className="flex flex-wrap justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link href="/dashboard">Go to the dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/register">Create an account</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
`;
}
