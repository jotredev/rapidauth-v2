import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { getAdminAccess } from '@/lib/admin-access';
import { getOperationalLogs } from '@/actions/operational-logs';
import { SystemLogsContent } from '@/components/dashboard';
import { getColumnsCookieName, readHiddenColumns } from '@/lib/table-columns';
import type { RawSearchParams } from '@/lib/table-query';
import { operationalLogTableQuery } from '@/lib/operational-log-query';

interface LogsPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  if ((await getAdminAccess(session)) !== 'admin') {
    redirect('/dashboard');
  }

  const cookieStore = await cookies();
  const hiddenColumns = readHiddenColumns(
    cookieStore.get(getColumnsCookieName('system-logs'))?.value,
  );

  const params = operationalLogTableQuery.parse(await searchParams);
  const result = await getOperationalLogs(params);

  if (result.response === 'error' || !result.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.data.page !== params.page) {
    redirect(
      `/dashboard/logs?${operationalLogTableQuery.toQueryString({
        ...params,
        page: result.data.page,
      })}`,
    );
  }

  return (
    <SystemLogsContent
      logs={result.data.logs}
      total={result.data.total}
      totalPages={result.data.totalPages}
      params={params}
      filterUser={result.data.filterUser}
      hiddenColumns={hiddenColumns}
    />
  );
}
