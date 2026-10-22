'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';
import { Button } from '@/components/ui/button';
import {
  Sun,
  Moon,
  PanelLeft,
} from 'lucide-react';
import { MobileSidebar, type NavSection, type UserProfile } from './sidebar';
import { DateRangePicker } from './date-range-picker';

interface HeaderProps {
  sidebarProps?: {
    brandName?: string;
    version?: string;
    navigation?: NavSection[];
    user?: UserProfile;
    onLogout?: () => void;
  };
  collapsed: boolean;
  onToggleSidebar: () => void;
  showDateRange?: boolean;
  className?: string;
}

function getPageTitle(pathname: string, navigation?: NavSection[]): string {
  const items = navigation?.flatMap((section) => section.items) ?? [];

  const exactMatch = items.find((item) => item.href === pathname);
  if (exactMatch) {
    return exactMatch.title;
  }

  let bestMatch: (typeof items)[0] | undefined;
  for (const item of items) {
    if (item.href === '/dashboard') continue;
    if (pathname.startsWith(item.href + '/')) {
      if (!bestMatch || item.href.length > bestMatch.href.length) {
        bestMatch = item;
      }
    }
  }

  if (bestMatch) {
    return bestMatch.title;
  }

  return 'Dashboard';
}

export function Header({
  sidebarProps,
  collapsed,
  onToggleSidebar,
  showDateRange,
  className,
}: HeaderProps) {
  const pathname = usePathname();
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  const pageTitle = getPageTitle(pathname, sidebarProps?.navigation);

  return (
    <header
      className={cn(
        'h-[54px] min-w-0 shrink-0 border-b border-border bg-background flex items-center gap-2 px-3 sm:gap-2.5 sm:px-5',
        className,
      )}
    >
      {/* Sidebar Toggle for Desktop */}
      <Button
        variant='ghost'
        size='icon'
        className='hidden lg:inline-flex size-8 aria-expanded:bg-transparent aria-expanded:text-muted-foreground text-muted-foreground hover:text-foreground'
        aria-label='Toggle sidebar'
        aria-expanded={!collapsed}
        onClick={onToggleSidebar}
      >
        <PanelLeft className='size-4' strokeWidth={1.75} />
      </Button>

      {/* Mobile Sidebar */}
      {sidebarProps && <MobileSidebar {...sidebarProps} />}

      {/* Breadcrumb */}
      <nav aria-label='Breadcrumb' className='flex items-center gap-2.5 text-[15px] min-w-0'>
        <span className='hidden sm:inline text-foreground'>RapidAuth</span>
        <span className='hidden sm:inline text-muted-foreground'>/</span>
        <span className='truncate text-foreground'>{pageTitle}</span>
      </nav>

      {/* Right Actions */}
      <div className='ml-auto flex items-center gap-1 shrink-0'>
        {showDateRange && (
          <React.Suspense fallback={null}>
            <DateRangePicker />
          </React.Suspense>
        )}
        {/* Theme Toggle */}
        <Button
          variant='ghost'
          size='icon'
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className='size-8 text-muted-foreground hover:text-foreground'
        >
          {mounted && theme === 'dark' ? (
            <Sun className='size-4' strokeWidth={1.75} />
          ) : (
            <Moon className='size-4' strokeWidth={1.75} />
          )}
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
