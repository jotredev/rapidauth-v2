import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminAccess } from "@/lib/admin-access";
import { parseDashboardRange } from "@/lib/dashboard-range";
import { getDashboardMetrics, getUserData } from "@/actions/dashboard";
import { DashboardContent, UserWelcome } from "@/components/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const adminAccess = await getAdminAccess(session);

  if (adminAccess === 'admin') {
    const range = parseDashboardRange((await searchParams).range);
    const result = await getDashboardMetrics(range);

    if (result.response === 'error' || !result.data) {
      return (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">{result.message}</p>
        </div>
      );
    }

    return (
      <DashboardContent
        metrics={result.data.metrics}
        chartData={result.data.chartData}
        unit={result.data.unit}
        range={result.data.range}
        recentUsers={result.data.recentUsers}
      />
    );
  }

  if (adminAccess === 'two-factor-required') {
    return (
      <Alert>
        <AlertTitle>
          <h2>Two-factor authentication required</h2>
        </AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            Activate two-factor authentication in Profile → Security before
            using the admin panel.
          </p>
          <Button asChild>
            <Link href="/dashboard/profile">Open Profile</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // For non-admin users, show welcome page
  const result = await getUserData();

  if (result.response === 'error' || !result.data) {
    redirect("/auth/login");
  }

  return <UserWelcome user={result.data} />;
}
