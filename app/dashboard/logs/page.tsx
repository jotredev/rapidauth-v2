import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAdminAccess } from '@/lib/admin-access';
import { getOperationalLogs } from '@/actions/operational-logs';
import { SystemLogsContent } from '@/components/dashboard';
import {
  buildOperationalLogQueryString,
  parseOperationalLogSearchParams,
  type OperationalLogSearchParams,
} from '@/lib/operational-log-query';

interface LogsPageProps {
  searchParams: Promise<OperationalLogSearchParams>;
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  if ((await getAdminAccess(session)) !== 'admin') {
    redirect('/dashboard');
  }

  const params = parseOperationalLogSearchParams(await searchParams);
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
      `/dashboard/logs?${buildOperationalLogQueryString({
        ...params,
        page: result.data.page,
      })}`,
    );
  }

  return (
    <SystemLogsContent
      logs={result.data.logs}
      total={result.data.total}
      page={result.data.page}
      pageSize={result.data.pageSize}
      totalPages={result.data.totalPages}
      initialParams={params}
      filterUser={result.data.filterUser}
    />
  );
}
