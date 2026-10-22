import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProfileData } from "@/actions/profile";
import { ProfileContent } from "@/components/dashboard";
import {
  parseProfileSearchParams,
  buildProfileQueryString,
  type ProfileSearchParams,
  type ProfileListParams,
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
  const result = await getProfileData(params);

  if (result.response === 'error' || !result.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (
    result.data.activityPage !== params.activityPage ||
    result.data.sessionsPage !== params.sessionsPage
  ) {
    const correctedParams: ProfileListParams = {
      ...params,
      activityPage: result.data.activityPage,
      sessionsPage: result.data.sessionsPage,
    };
    const qs = buildProfileQueryString(correctedParams);
    redirect(qs ? `/dashboard/profile?${qs}` : '/dashboard/profile');
  }

  return (
    <ProfileContent
      initialProfile={result.data.profile}
      twoFactorEnabled={result.data.twoFactorEnabled}
      isOAuthUser={result.data.isOAuthUser}
      hasPassword={result.data.hasPassword}
      activityLogs={result.data.activityLogs}
      sessions={result.data.sessions}
      initialParams={params}
      activityPage={result.data.activityPage}
      activityTotalPages={result.data.activityTotalPages}
      sessionsTotal={result.data.sessionsTotal}
      sessionsPage={result.data.sessionsPage}
      sessionsTotalPages={result.data.sessionsTotalPages}
      pageSize={result.data.pageSize}
    />
  );
}
