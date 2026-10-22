'use client';

import * as React from 'react';
import { useRouter } from 'nextjs-toploader/app';
import {
  PageHeader,
  DataTable,
  ColumnPicker,
  type Column,
} from '@/components/dashboard';
import { TableFooter } from '@/components/dashboard/table-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  SlidersHorizontal,
  LogIn,
  LogOut,
  UserPlus,
  KeyRound,
  Shield,
  ShieldOff,
  ShieldCheck,
  UserCog,
  Trash2,
  Eye,
  X,
  Monitor,
  Globe,
  Clock,
  ScrollText,
  Mail,
  MailCheck,
  Link as LinkIcon,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageSize } from '@/lib/list-pagination';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_SEARCH_MAX_LENGTH,
  buildActivityLogQueryString,
  type ActivityAction,
  type ActivityLogListParams,
} from '@/lib/activity-log-query';
import type { ActivityLog } from '@/actions/activity';

const actionConfig: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
  }
> = {
  login: { icon: LogIn, label: 'Login' },
  logout: { icon: LogOut, label: 'Logout' },
  register: { icon: UserPlus, label: 'Register' },
  profile_update: { icon: UserCog, label: 'Profile Update' },
  password_change: { icon: KeyRound, label: 'Password Change' },
  email_change: { icon: Mail, label: 'Email Change' },
  avatar_change: { icon: UserCog, label: 'Avatar Change' },
  '2fa_enabled': { icon: Shield, label: '2FA Enabled' },
  '2fa_disabled': { icon: ShieldOff, label: '2FA Disabled' },
  '2fa_verified': { icon: ShieldCheck, label: '2FA Verified' },
  email_verified: { icon: MailCheck, label: 'Email Verified' },
  oauth_login: { icon: LogIn, label: 'OAuth Login' },
  oauth_link: { icon: LinkIcon, label: 'OAuth Link' },
  terms_accepted: { icon: ScrollText, label: 'Terms Accepted' },
  invitation_accepted: { icon: UserCheck, label: 'Invitation Accepted' },
  session_revoked: { icon: LogOut, label: 'Session Revoked' },
  user_deleted: { icon: Trash2, label: 'User Deleted' },
};

function getActionConfig(action: string): {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
} {
  return (
    actionConfig[action] || {
      icon: Eye,
      label: action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    }
  );
}

function formatUtc(isoString: string): string {
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
}

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };

  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

  return { browser, os };
}

interface ActivityLogsContentProps {
  logs: ActivityLog[];
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
  initialParams: ActivityLogListParams;
  hiddenColumns: string[];
}

export function ActivityLogsContent({
  logs,
  total,
  page,
  pageSize,
  totalPages,
  initialParams,
  hiddenColumns,
}: ActivityLogsContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [hidden, setHidden] = React.useState<string[]>(hiddenColumns);
  const [prevHiddenColumns, setPrevHiddenColumns] = React.useState<string[]>(hiddenColumns);

  if (hiddenColumns.join('.') !== prevHiddenColumns.join('.')) {
    setPrevHiddenColumns(hiddenColumns);
    setHidden(hiddenColumns);
  }

  const [searchQuery, setSearchQuery] = React.useState(initialParams.q);
  const [prevInitialQ, setPrevInitialQ] = React.useState(initialParams.q);
  const [pendingSearches, setPendingSearches] = React.useState<string[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<ActivityLog | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = React.useState(false);

  if (initialParams.q !== prevInitialQ) {
    setPrevInitialQ(initialParams.q);
    const pendingIndex = pendingSearches.indexOf(initialParams.q);
    if (pendingIndex >= 0) {
      setPendingSearches(pendingSearches.slice(pendingIndex + 1));
    } else {
      setPendingSearches([]);
      setSearchQuery(initialParams.q);
    }
  }

  const normalizedSearch = searchQuery.trim().slice(0, ACTIVITY_SEARCH_MAX_LENGTH);

  const navigate = React.useCallback(
    (next: ActivityLogListParams) => {
      startTransition(() => {
        router.replace(
          `/dashboard/activity?${buildActivityLogQueryString(next)}`,
          { scroll: false },
        );
      });
    },
    [router],
  );

  React.useEffect(() => {
    if (normalizedSearch === initialParams.q) return;

    const timer = window.setTimeout(() => {
      setPendingSearches((prev) => [...prev, normalizedSearch]);
      navigate({ ...initialParams, q: normalizedSearch, page: 1 });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [normalizedSearch, initialParams, navigate]);

  const toggleAction = (action: ActivityAction) => {
    const nextActions = initialParams.actions.includes(action)
      ? initialParams.actions.filter((a) => a !== action)
      : [...initialParams.actions, action];
    if (normalizedSearch !== initialParams.q) {
      setPendingSearches((prev) => [...prev, normalizedSearch]);
    }
    navigate({
      ...initialParams,
      q: normalizedSearch,
      actions: nextActions,
      page: 1,
    });
  };

  const removeAction = (action: ActivityAction) => {
    if (normalizedSearch !== initialParams.q) {
      setPendingSearches((prev) => [...prev, normalizedSearch]);
    }
    navigate({
      ...initialParams,
      q: normalizedSearch,
      actions: initialParams.actions.filter((a) => a !== action),
      page: 1,
    });
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setPendingSearches((prev) => [...prev, '']);
    navigate({
      ...initialParams,
      q: '',
      actions: [],
      page: 1,
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPendingSearches((prev) => [...prev, '']);
    navigate({
      ...initialParams,
      q: '',
      page: 1,
    });
  };

  const handlePageChange = (newPage: number) => {
    if (normalizedSearch !== initialParams.q) {
      setPendingSearches((prev) => [...prev, normalizedSearch]);
    }
    navigate({
      ...initialParams,
      q: normalizedSearch,
      page: newPage,
    });
  };

  const handlePageSizeChange = (newPageSize: PageSize) => {
    if (normalizedSearch !== initialParams.q) {
      setPendingSearches((prev) => [...prev, normalizedSearch]);
    }
    navigate({
      ...initialParams,
      q: normalizedSearch,
      page: 1,
      pageSize: newPageSize,
    });
  };

  const getPageHref = React.useCallback(
    (targetPage: number) =>
      `/dashboard/activity?${buildActivityLogQueryString({
        ...initialParams,
        q: normalizedSearch,
        page: targetPage,
      })}`,
    [initialParams, normalizedSearch],
  );

  const openDetailsSheet = (log: ActivityLog) => {
    setSelectedLog(log);
    setDetailsSheetOpen(true);
  };

  const allColumns: Column<ActivityLog>[] = [
    {
      key: 'user',
      header: 'User',
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-foreground font-normal">{item.userName}</span>
          <span className="text-xs text-muted-foreground">{item.userEmail}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (item) => {
        const config = getActionConfig(item.action);
        const Icon = config.icon;
        return (
          <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
            <Icon className="size-3" strokeWidth={1.75} />
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (item) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {item.ipAddress || 'N/A'}
        </span>
      ),
    },
    {
      key: 'device',
      header: 'Device',
      render: (item) => {
        const { browser, os } = parseUserAgent(item.userAgent);
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Monitor className="h-3 w-3" />
            <span>
              {browser} / {os}
            </span>
          </div>
        );
      },
    },
    {
      key: 'time',
      header: 'Time',
      render: (item) => (
        <span className="font-mono text-[13px] text-muted-foreground whitespace-nowrap">
          {formatUtc(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDetailsSheet(item);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];
  const columns = allColumns.filter((c) => !hidden.includes(c.key));

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="Monitor user activities and system events."
      />

      <div className="flex flex-col">
        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-2.5 px-5 py-2.5">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, email, action, or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 font-mono text-sm pl-9 bg-background border-border"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {initialParams.actions.length > 0 && (
                    <span className="rounded bg-muted px-1.5 text-[13px]">
                      {initialParams.actions.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0 bg-card border-border">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h4 className="text-sm font-semibold">Filters</h4>
                  {initialParams.actions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs text-link hover:underline font-normal cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <label className="text-sm text-muted-foreground font-normal">
                    Action Type
                  </label>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {ACTIVITY_ACTIONS.map((action) => {
                      const config = getActionConfig(action);
                      const isChecked = initialParams.actions.includes(action);
                      return (
                        <div key={action} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-${action}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleAction(action)}
                          />
                          <Label
                            htmlFor={`filter-${action}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {config.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <ColumnPicker
              tableId="activity"
              hidden={hidden}
              onHiddenChange={setHidden}
            />
          </div>

          {/* Active Filters and Results Count */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {initialParams.actions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-normal">
                    Active filters:
                  </span>
                  {initialParams.actions.map((action) => {
                    const config = getActionConfig(action);
                    return (
                      <Badge
                        key={action}
                        variant="secondary"
                        className="gap-1 cursor-pointer hover:bg-secondary/80 font-normal text-xs"
                        onClick={() => removeAction(action)}
                      >
                        {config.label}
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-muted-foreground hover:text-foreground ml-2 font-normal cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <p
              className="ml-auto text-sm text-muted-foreground font-normal"
              aria-live="polite"
            >
              {total === 0
                ? 'Showing 0 of 0 logs'
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                    page * pageSize,
                    total,
                  )} of ${total} logs`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div
          className={cn(
            'border-t border-border transition-opacity',
            isPending && 'opacity-50',
          )}
          aria-busy={isPending}
        >
          <DataTable
            columns={columns}
            data={logs}
            onRowClick={openDetailsSheet}
          />
        </div>

        {/* Table Footer */}
        <TableFooter
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          isPending={isPending}
          getPageHref={getPageHref}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Details Sheet */}
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Activity Details</SheetTitle>
            <SheetDescription>
              Full details of the selected activity log.
            </SheetDescription>
          </SheetHeader>
          {selectedLog && (
            <div className="p-4 space-y-6">
              {/* User Info */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">User</p>
                <p className="font-semibold">{selectedLog.userName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLog.userEmail}
                </p>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Action</p>
                {(() => {
                  const config = getActionConfig(selectedLog.action);
                  const Icon = config.icon;
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground/80">
                      <Icon className="size-3" strokeWidth={1.75} />
                      {config.label}
                    </span>
                  );
                })()}
              </div>

              {/* IP Address */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> IP Address
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {selectedLog.ipAddress || 'N/A'}
                </p>
              </div>

              {/* Timestamp */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Timestamp
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {formatUtc(selectedLog.createdAt)} UTC
                </p>
              </div>

              {/* Device Info */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> Device Info
                </p>
                {(() => {
                  const { browser, os } = parseUserAgent(selectedLog.userAgent);
                  return (
                    <p className="text-sm">
                      {browser} on {os}
                    </p>
                  );
                })()}
                {selectedLog.userAgent && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">
                    {selectedLog.userAgent}
                  </p>
                )}
              </div>

              {/* Additional Details */}
              {selectedLog.details && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Additional Details
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
