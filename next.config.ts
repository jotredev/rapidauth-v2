import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { withSentryConfig } from "@sentry/nextjs/config";
import {
  getSentryBuildConfig,
  getSentryEnvironment,
} from "./lib/sentry-config";
import {
  getSupportEmail,
  getSupportEmailConfigError,
} from "./lib/support-email";
import { siteConfig } from "./config/site";

const nextConfig = (phase: string): NextConfig => {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const supportEmailError = getSupportEmailConfigError(process.env);
    if (supportEmailError) throw new Error(supportEmailError);

    const exampleValues = [
      siteConfig.legalEntityName.startsWith("REPLACE_WITH_") && "legalEntityName",
      siteConfig.governingLaw.startsWith("REPLACE_WITH_") && "governingLaw",
    ].filter(Boolean);
    if (exampleValues.length > 0) {
      console.warn(
        `\n⚠️  LEGAL CONFIGURATION: ${exampleValues.join(", ")} still use example values in config/site.ts. Replace them before deploying ${siteConfig.appName}.\n`,
      );
    }

    if ((process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() === 'local') {
      console.warn(
        '\n⚠️  FILE STORAGE: STORAGE_DRIVER=local stores uploaded files on this server. Configure persistent disk or mount a volume at /app/storage in production. See docs/en/05-file-storage.md.\n',
      );
    }
  }

  return {
    experimental: {
      serverActions: { bodySizeLimit: '4.25mb' },
    },
    env: {
      NEXT_PUBLIC_SENTRY_ENVIRONMENT: getSentryEnvironment(process.env),
      SENTRY_TRACES_SAMPLE_RATE:
        process.env.SENTRY_TRACES_SAMPLE_RATE?.trim() || '0',
      SUPPORT_EMAIL: getSupportEmail(process.env) ?? '',
    },
    logging: { serverFunctions: false },
    distDir: ".next",
    reactCompiler: true,
    output: "standalone",
    outputFileTracingIncludes: {
      "/*": ["./node_modules/.prisma/client/**/*"],
    },
    ...(process.env.DOCKER_DEV_POLLING === "true"
      ? { watchOptions: { pollIntervalMs: 1000 } }
      : {}),
    images: {
      remotePatterns: [
        { protocol: "https", hostname: "images.unsplash.com" },
        { protocol: "https", hostname: "lh3.googleusercontent.com" },
        { protocol: "https", hostname: "avatars.githubusercontent.com" },
      ],
    },
  };
};

const buildConfig = getSentryBuildConfig(process.env);

export default withSentryConfig(nextConfig, {
  authToken: buildConfig.authToken,
  org: buildConfig.org,
  project: buildConfig.project,
  silent: true,
  sourcemaps: { disable: !buildConfig.enabled },
  telemetry: false,
});
