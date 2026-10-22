import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/lib/list-pagination';
import {
  parseUserListSearchParams,
  type UserListParams,
} from '@/lib/user-list-query';
import type { Filters } from '../types';
import {
  createEmptyFilters,
  getActiveFilterCount,
  removeFilter as removeFilterHelper,
} from '../helpers';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;

interface UseUsersFiltersOptions {
  initialParams: UserListParams;
  onParamsChange: () => void;
}

function getParamsKey(
  query: string,
  filters: {
    roles: readonly string[];
    statuses: readonly string[];
    providers: readonly string[];
  },
  page: number,
  pageSize: number,
) {
  return JSON.stringify([
    page,
    query.trim().slice(0, SEARCH_MAX_LENGTH),
    filters.roles,
    filters.statuses,
    filters.providers,
    pageSize,
  ]);
}

export function useUsersFilters({
  initialParams,
  onParamsChange,
}: UseUsersFiltersOptions) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQueryState] = useState(initialParams.q);
  const [filters, setFiltersState] = useState<Filters>({
    roles: initialParams.roles,
    statuses: initialParams.statuses,
    providers: initialParams.providers,
  });
  const urlParams = parseUserListSearchParams({
    page: currentSearchParams.get('page') ?? undefined,
    pageSize: currentSearchParams.get('pageSize') ?? undefined,
    q: currentSearchParams.get('q') ?? undefined,
    role: currentSearchParams.getAll('role'),
    status: currentSearchParams.getAll('status'),
    provider: currentSearchParams.getAll('provider'),
  });
  const urlParamsKey = getParamsKey(urlParams.q, urlParams, urlParams.page, urlParams.pageSize);
  const [previousUrlParamsKey, setPreviousUrlParamsKey] =
    useState(urlParamsKey);
  const [pendingParamsKeys, setPendingParamsKeys] = useState<string[]>([]);

  // Responses to our own navigations must not overwrite newer local input.
  // Any URL signature we did not request is external and becomes the source of truth.
  if (urlParamsKey !== previousUrlParamsKey) {
    setPreviousUrlParamsKey(urlParamsKey);
    const pendingIndex = pendingParamsKeys.indexOf(urlParamsKey);

    if (pendingIndex >= 0) {
      setPendingParamsKeys(pendingParamsKeys.slice(pendingIndex + 1));
    } else {
      setPendingParamsKeys([]);
      setSearchQueryState(urlParams.q);
      setFiltersState({
        roles: urlParams.roles,
        statuses: urlParams.statuses,
        providers: urlParams.providers,
      });
      onParamsChange();
    }
  }

  const createUrl = useCallback(
    (
      query: string,
      nextFilters: Filters,
      page: number,
      pageSize: PageSize = urlParams.pageSize,
    ) => {
      const params = new URLSearchParams(currentSearchParams.toString());
      ['page', 'pageSize', 'q', 'role', 'status', 'provider'].forEach((key) =>
        params.delete(key),
      );

      params.set('page', String(page));
      if (pageSize !== DEFAULT_PAGE_SIZE) {
        params.set('pageSize', String(pageSize));
      }
      const normalizedQuery = query.trim().slice(0, SEARCH_MAX_LENGTH);
      if (normalizedQuery) params.set('q', normalizedQuery);
      nextFilters.roles.forEach((role) => params.append('role', role));
      nextFilters.statuses.forEach((status) => params.append('status', status));
      nextFilters.providers.forEach((provider) =>
        params.append('provider', provider),
      );

      return `/dashboard/users?${params.toString()}`;
    },
    [currentSearchParams, urlParams.pageSize],
  );

  const replaceUrl = useCallback(
    (
      query: string,
      nextFilters: Filters,
      page: number,
      pageSize: PageSize = urlParams.pageSize,
    ) => {
      const paramsKey = getParamsKey(query, nextFilters, page, pageSize);
      if (pendingParamsKeys.includes(paramsKey)) return;

      setPendingParamsKeys([...pendingParamsKeys, paramsKey]);
      startTransition(() => {
        router.replace(createUrl(query, nextFilters, page, pageSize), {
          scroll: false,
        });
      });
    },
    [createUrl, pendingParamsKeys, router, urlParams.pageSize],
  );

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().slice(0, SEARCH_MAX_LENGTH);
    if (normalizedQuery === urlParams.q) return;

    const timeout = window.setTimeout(() => {
      replaceUrl(normalizedQuery, filters, 1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [filters, replaceUrl, searchQuery, urlParams.q]);

  const setSearchQuery = useCallback(
    (query: string) => {
      onParamsChange();
      setSearchQueryState(query.slice(0, SEARCH_MAX_LENGTH));
    },
    [onParamsChange],
  );

  const setFilters = useCallback(
    (nextFilters: Filters) => {
      onParamsChange();
      setFiltersState(nextFilters);
      replaceUrl(searchQuery, nextFilters, 1);
    },
    [onParamsChange, replaceUrl, searchQuery],
  );

  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filters),
    [filters]
  );

  const removeFilter = useCallback(
    (type: 'role' | 'status' | 'provider', value: string) => {
      setFilters(removeFilterHelper(filters, type, value));
    },
    [filters, setFilters],
  );

  const clearAllFilters = useCallback(() => {
    const emptyFilters = createEmptyFilters();
    onParamsChange();
    setSearchQueryState('');
    setFiltersState(emptyFilters);
    replaceUrl('', emptyFilters, 1);
  }, [onParamsChange, replaceUrl]);

  const goToPage = useCallback(
    (page: number) => {
      onParamsChange();
      replaceUrl(searchQuery, filters, page);
    },
    [filters, onParamsChange, replaceUrl, searchQuery],
  );

  const setPageSize = useCallback(
    (pageSize: PageSize) => {
      onParamsChange();
      replaceUrl(searchQuery, filters, 1, pageSize);
    },
    [filters, onParamsChange, replaceUrl, searchQuery],
  );

  const getPageHref = useCallback(
    (page: number) => createUrl(searchQuery, filters, page),
    [createUrl, filters, searchQuery],
  );

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    activeFilterCount,
    removeFilter,
    clearAllFilters,
    goToPage,
    setPageSize,
    getPageHref,
    isPending,
  };
}
