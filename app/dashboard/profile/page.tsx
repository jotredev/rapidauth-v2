import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  getMyActivityLogs,
  getMySessions,
  getProfileData,
} from "@/actions/profile";
import { ProfileContent } from "@/components/dashboard";
import { getColumnsCookieName, readHiddenColumns } from "@/lib/table-columns";
import {
  parseProfileSearchParams,
  buildProfileQueryString,
  profileActivityTableQuery,
  profileSessionsTableQuery,
  type ProfileSearchParams,
} from "@/lib/profile-query";

interface ProfilePageProps {
  searchParams: Promise<ProfileSearchParams>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const rawSearchParams = await searchParams;
  const params = parseProfileSearchParams(rawSearchParams);
  const activityParams = profileActivityTableQuery.parse(rawSearchParams);
  const sessionsParams = profileSessionsTableQuery.parse(rawSearchParams);

  const cookieStore = await cookies();
  const activityHiddenColumns = readHiddenColumns(
    cookieStore.get(getColumnsCookieName("profile-activity"))?.value,
  );
  const sessionsHiddenColumns = readHiddenColumns(
    cookieStore.get(getColumnsCookieName("profile-sessions"))?.value,
  );

  const [result, activityResult, sessionsResult] = await Promise.all([
    getProfileData(),
    getMyActivityLogs(activityParams),
    getMySessions(sessionsParams),
  ]);

  if (result.response === 'error' || !result.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (activityResult.response === 'error' || !activityResult.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{activityResult.message}</p>
      </div>
    );
  }

  if (sessionsResult.response === 'error' || !sessionsResult.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{sessionsResult.message}</p>
      </div>
    );
  }

  if (
    activityResult.data.page !== activityParams.page ||
    sessionsResult.data.page !== sessionsParams.page
  ) {
    const query = buildProfileQueryString(
      params.tab,
      { ...activityParams, page: activityResult.data.page },
      { ...sessionsParams, page: sessionsResult.data.page },
    );
    redirect(query ? `/dashboard/profile?${query}` : '/dashboard/profile');
  }

  return (
    <ProfileContent
      initialProfile={result.data.profile}
      twoFactorEnabled={result.data.twoFactorEnabled}
      isOAuthUser={result.data.isOAuthUser}
      hasPassword={result.data.hasPassword}
      activityLogs={activityResult.data.logs}
      activityTotal={activityResult.data.total}
      activityTotalPages={activityResult.data.totalPages}
      activityParams={activityParams}
      activityHiddenColumns={activityHiddenColumns}
      sessions={sessionsResult.data.sessions}
      sessionsTotal={sessionsResult.data.total}
      sessionsTotalPages={sessionsResult.data.totalPages}
      sessionsParams={sessionsParams}
      sessionsHiddenColumns={sessionsHiddenColumns}
      initialParams={params}
    />
  );
}
