import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { getAdminAccess } from '@/lib/admin-access';
import { getActivityLogs } from '@/actions/activity';
import { ActivityLogsContent } from '@/components/dashboard/activity-logs-content';
import { getColumnsCookieName, readHiddenColumns } from '@/lib/table-columns';
import {
  buildActivityLogQueryString,
  parseActivityLogSearchParams,
  type ActivityLogSearchParams,
} from '@/lib/activity-log-query';

interface ActivityPageProps {
  searchParams: Promise<ActivityLogSearchParams>;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  if ((await getAdminAccess(session)) !== 'admin') {
    redirect('/dashboard');
  }

  const cookieStore = await cookies();
  const hiddenColumns = readHiddenColumns(
    'activity',
    cookieStore.get(getColumnsCookieName('activity'))?.value,
  );

  const params = parseActivityLogSearchParams(await searchParams);
  const result = await getActivityLogs(params);

  if (result.response === 'error' || !result.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.data.page !== params.page) {
    redirect(
      `/dashboard/activity?${buildActivityLogQueryString({
        ...params,
        page: result.data.page,
      })}`,
    );
  }

  return (
    <ActivityLogsContent
      logs={result.data.logs}
      total={result.data.total}
      page={result.data.page}
      pageSize={result.data.pageSize}
      totalPages={result.data.totalPages}
      initialParams={params}
      hiddenColumns={hiddenColumns}
    />
  );
}
