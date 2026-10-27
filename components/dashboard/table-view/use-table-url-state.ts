'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import type { PageSize } from '@/lib/list-pagination';
import type {
  RawSearchParams,
  TableParams,
  TableQuery,
} from '@/lib/table-query';

const SEARCH_DEBOUNCE_MS = 300;

interface UseTableUrlStateOptions<F extends string> {
  basePath: string;
  query: TableQuery<F>;
  params: TableParams<F>;
  /** Called whenever page, search, filters or page size change, also when the URL changes from outside. */
  onChange: () => void;
}

function toRawSearchParams(searchParams: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};
  for (const key of new Set(searchParams.keys())) {
    raw[key] = searchParams.getAll(key);
  }
  return raw;
}

export function useTableUrlState<F extends string>({
  basePath,
  query,
  params,
  onChange,
}: UseTableUrlStateOptions<F>) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchMaxLength = query.config.searchMaxLength;
  const [searchQuery, setSearchQueryState] = useState(params.q);
  const [filters, setFiltersState] = useState<Record<F, string[]>>(
    params.filters,
  );
  const urlParams = query.parse(toRawSearchParams(currentSearchParams));
  const urlParamsKey = query.toQueryString(urlParams);
  const [previousUrlParamsKey, setPreviousUrlParamsKey] =
    useState(urlParamsKey);
  const [pendingParamsKeys, setPendingParamsKeys] = useState<string[]>([]);
  const [externalChanges, setExternalChanges] = useState(0);

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
      setFiltersState(urlParams.filters);
      setExternalChanges((count) => count + 1);
    }
  }

  // The parent may own state (a controlled selection), so it is notified after render.
  const notifyChange = useEffectEvent(onChange);
  useEffect(() => {
    if (externalChanges > 0) notifyChange();
  }, [externalChanges]);

  const buildParams = useCallback(
    (
      q: string,
      nextFilters: Record<F, string[]>,
      page: number,
      pageSize: PageSize,
    ): TableParams<F> => ({
      page,
      pageSize,
      q: q.trim().slice(0, searchMaxLength ?? 0),
      filters: nextFilters,
    }),
    [searchMaxLength],
  );

  const createUrl = useCallback(
    (
      q: string,
      nextFilters: Record<F, string[]>,
      page: number,
      pageSize: PageSize = urlParams.pageSize,
    ) => {
      const managedKeys = [
        query.paramNames.page,
        query.paramNames.pageSize,
        ...(searchMaxLength === undefined ? [] : [query.paramNames.q]),
        ...(Object.values(query.config.filters) as { param: string }[]).map(
          (definition) => definition.param,
        ),
      ];
      // Keep every parameter this list does not manage.
      const next = new URLSearchParams(currentSearchParams.toString());
      managedKeys.forEach((key) => next.delete(key));
      new URLSearchParams(
        query.toQueryString(buildParams(q, nextFilters, page, pageSize)),
      ).forEach((value, key) => next.append(key, value));

      return `${basePath}?${next.toString()}`;
    },
    [
      basePath,
      buildParams,
      currentSearchParams,
      query,
      searchMaxLength,
      urlParams.pageSize,
    ],
  );

  const replaceUrl = useCallback(
    (
      q: string,
      nextFilters: Record<F, string[]>,
      page: number,
      pageSize: PageSize = urlParams.pageSize,
    ) => {
      const paramsKey = query.toQueryString(
        buildParams(q, nextFilters, page, pageSize),
      );
      if (pendingParamsKeys.includes(paramsKey)) return;

      setPendingParamsKeys([...pendingParamsKeys, paramsKey]);
      startTransition(() => {
        router.replace(createUrl(q, nextFilters, page, pageSize), {
          scroll: false,
        });
      });
    },
    [
      buildParams,
      createUrl,
      pendingParamsKeys,
      query,
      router,
      urlParams.pageSize,
    ],
  );

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().slice(0, searchMaxLength ?? 0);
    if (normalizedQuery === urlParams.q) return;

    const timeout = window.setTimeout(() => {
      replaceUrl(normalizedQuery, filters, 1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [filters, replaceUrl, searchMaxLength, searchQuery, urlParams.q]);

  const setSearchQuery = useCallback(
    (value: string) => {
      onChange();
      setSearchQueryState(value.slice(0, searchMaxLength ?? 0));
    },
    [onChange, searchMaxLength],
  );

  const applyFilters = useCallback(
    (nextFilters: Record<F, string[]>) => {
      onChange();
      setFiltersState(nextFilters);
      replaceUrl(searchQuery, nextFilters, 1);
    },
    [onChange, replaceUrl, searchQuery],
  );

  const toggleFilterValue = useCallback(
    (key: F, value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : query.config.filters[key].multiple
          ? [...current, value]
          : [value];
      applyFilters({ ...filters, [key]: next });
    },
    [applyFilters, filters, query],
  );

  const removeFilterValue = useCallback(
    (key: F, value: string) => {
      applyFilters({
        ...filters,
        [key]: filters[key].filter((item) => item !== value),
      });
    },
    [applyFilters, filters],
  );

  const clearFilters = useCallback(() => {
    applyFilters(query.empty().filters);
  }, [applyFilters, query]);

  const clearAll = useCallback(() => {
    const emptyFilters = query.empty().filters;
    onChange();
    setSearchQueryState('');
    setFiltersState(emptyFilters);
    replaceUrl('', emptyFilters, 1);
  }, [onChange, query, replaceUrl]);

  const goToPage = useCallback(
    (page: number) => {
      onChange();
      replaceUrl(searchQuery, filters, page);
    },
    [filters, onChange, replaceUrl, searchQuery],
  );

  const setPageSize = useCallback(
    (pageSize: PageSize) => {
      onChange();
      replaceUrl(searchQuery, filters, 1, pageSize);
    },
    [filters, onChange, replaceUrl, searchQuery],
  );

  const getPageHref = useCallback(
    (page: number) => createUrl(searchQuery, filters, page),
    [createUrl, filters, searchQuery],
  );

  return {
    searchQuery,
    setSearchQuery,
    filters,
    toggleFilterValue,
    removeFilterValue,
    clearFilters,
    clearAll,
    goToPage,
    setPageSize,
    getPageHref,
    isPending,
  };
}
