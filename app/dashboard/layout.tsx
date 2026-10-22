import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminAccess } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { hasAcceptedCurrentTerms } from "@/lib/terms-acceptance";
import { DashboardShell } from "@/components/dashboard";
import packageJson from "@/package.json";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  // Get user image and the server-authoritative terms acceptance from database.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      image: true,
      mustChangePassword: true,
      termsAcceptedAt: true,
      termsVersion: true,
    },
  });

  if (dbUser?.mustChangePassword) {
    redirect("/auth/change-password");
  }

  if (!dbUser || !hasAcceptedCurrentTerms(dbUser)) {
    redirect("/auth/accept-terms");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role ?? "User",
    avatar: dbUser?.image ?? session.user.image ?? undefined,
  };
  const hasAdminAccess = (await getAdminAccess(session)) === 'admin';

  return (
    <DashboardShell
      user={user}
      brandName="rapidauth"
      version={packageJson.version}
      hasAdminAccess={hasAdminAccess}
    >
      {children}
    </DashboardShell>
  );
}
