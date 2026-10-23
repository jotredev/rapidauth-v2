#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";
import { generatePassword } from "./generate-password";

// Load environment variables
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

// Create Prisma client with pg adapter (same as lib/prisma.ts)
const databaseUrl = process.env.DATABASE_URL!;
const connectionString = databaseUrl.includes("sslmode=")
  ? databaseUrl
  : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}sslmode=verify-full`;
const sslDisabled = new URL(connectionString).searchParams.get("sslmode") === "disable";

const pool = new Pool({
  connectionString,
  ssl: sslDisabled ? false : { rejectUnauthorized: true },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const icons = {
  success: "✓",
  info: "ℹ",
  arrow: "→",
};

// ============================================================================
// SEED DATA
// ============================================================================

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@admin.com").trim().toLowerCase();

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD;
  if (configuredPassword !== undefined && configuredPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters long");
  }

  console.log();
  console.log(`${colors.cyan}${icons.arrow} Seeding database...${colors.reset}`);
  console.log();

  const normalizedLegacyAccounts = await prisma.$executeRaw`
    UPDATE "account"
    SET "accountId" = "userId"
    WHERE "providerId" = 'credential'
      AND "accountId" <> "userId"
  `;

  if (normalizedLegacyAccounts > 0) {
    console.log(
      `${colors.green}${icons.success} Normalized ${normalizedLegacyAccounts} legacy credential account(s)${colors.reset}`,
    );
  }

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`${colors.yellow}${icons.info} Admin user already exists, skipping...${colors.reset}`);
    return;
  }

  // Create admin user
  const password = configuredPassword ?? generatePassword();
  const hashedPassword = await hashPassword(password);

  const admin = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: "Administrator",
        email: ADMIN_EMAIL,
        emailVerified: true,
        role: "admin",
      },
    });

    await transaction.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
        userId: user.id,
      },
    });

    return user;
  });

  console.log(`${colors.green}${icons.success} Created admin user:${colors.reset}`);
  console.log(`   ${colors.dim}Email:    ${ADMIN_EMAIL}${colors.reset}`);
  console.log(`   ${colors.dim}Password: ${password}${colors.reset}`);
  console.log(`   ${colors.yellow}Save this password and change it after your first login.${colors.reset}`);
  console.log(`   ${colors.dim}Role:     admin${colors.reset}`);
  console.log();

  // Log admin creation activity
  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      action: "account_created",
      details: JSON.stringify({ method: "seed", role: "admin" }),
    },
  });

  console.log(`${colors.green}${icons.success} Seed completed successfully${colors.reset}`);
  console.log();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
