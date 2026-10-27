import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getAdminAccess } from "@/lib/admin-access";
import { getUsers } from "@/actions/users";
import { UsersContent } from "@/components/dashboard";
import { getColumnsCookieName, readHiddenColumns } from "@/lib/table-columns";
import type { RawSearchParams } from "@/lib/table-query";
import { userTableQuery } from "@/lib/user-list-query";

interface UsersPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  if ((await getAdminAccess(session)) !== 'admin') {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const hiddenColumns = readHiddenColumns(
    cookieStore.get(getColumnsCookieName('users'))?.value,
  );

  const params = userTableQuery.parse(await searchParams);
  const result = await getUsers(params);

  if (result.response === 'error' || !result.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  if (result.data.page !== params.page) {
    redirect(
      `/dashboard/users?${userTableQuery.toQueryString({
        ...params,
        page: result.data.page,
      })}`,
    );
  }

  return (
    <UsersContent
      users={result.data.users}
      total={result.data.total}
      totalPages={result.data.totalPages}
      params={params}
      isAdmin={true}
      currentUserId={session.user.id}
      hiddenColumns={hiddenColumns}
    />
  );
}
