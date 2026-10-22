"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldCheck,
  User,
  LogOut,
  Menu,
  Search,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface SidebarProps {
  brandName?: string;
  version?: string;
  navigation?: NavSection[];
  user?: UserProfile;
  onLogout?: () => void | Promise<void>;
  onOpenCommand?: () => void;
  collapsed?: boolean;
  className?: string;
}

interface SidebarContentProps extends SidebarProps {
  inSheet?: boolean;
}

function SidebarContent({
  brandName = "rapidauth",
  version,
  navigation = [],
  user,
  onLogout,
  onOpenCommand,
  collapsed = false,
  inSheet = false,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Brand */}
      <div
        className={cn(
          "h-[54px] border-b border-sidebar-border flex items-center shrink-0",
          collapsed ? "justify-center px-0" : "px-[18px]",
          inSheet && "pr-12"
        )}
      >
        {collapsed ? (
          <Link
            href="/"
            aria-label={brandName}
            className="flex items-center justify-center"
          >
            <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} />
          </Link>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="text-[17px] font-normal truncate">{brandName}</span>
            </Link>
            {version && (
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                v{version}
              </span>
            )}
          </>
        )}
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <nav className="flex flex-col">
          {onOpenCommand &&
            (collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCommand}
                    className="flex items-center justify-center rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Search className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="sr-only">Go to...</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Go to... ⌘K</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onOpenCommand}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[15px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Search className="size-4 shrink-0" strokeWidth={1.75} />
                <span>Go to...</span>
                <kbd className="ml-auto text-xs text-muted-foreground font-sans">
                  ⌘ K
                </kbd>
              </button>
            ))}
          {navigation
            .filter((section) => section.items && section.items.length > 0)
            .map((section, sectionIdx) => (
              <div
                key={section.title ?? `section-${sectionIdx}`}
                className={cn(
                  collapsed && sectionIdx > 0 && "pt-3",
                  sectionIdx === 0 && onOpenCommand && "pt-1"
                )}
              >
                {!collapsed && section.title && (
                  <div className="px-2.5 pt-[18px] pb-1.5 text-sm text-muted-foreground font-normal">
                    {section.title}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              className={cn(
                                "flex items-center justify-center rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                isActive &&
                                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                              )}
                            >
                              <Icon
                                className="size-4 shrink-0"
                                strokeWidth={1.75}
                              />
                              <span className="sr-only">{item.title}</span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[15px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        )}
                      >
                        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </nav>
      </div>

      {/* User Profile */}
      <div
        className={cn(
          "border-t border-sidebar-border shrink-0",
          collapsed ? "p-2 flex justify-center" : "px-3.5 py-3"
        )}
      >
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "rounded-md hover:bg-sidebar-accent transition-colors text-left flex items-center",
                  collapsed
                    ? "justify-center p-1"
                    : "w-full gap-2.5 p-1"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {user.avatar && (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  )}
                  <AvatarFallback className="bg-muted text-xs text-sidebar-foreground">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {collapsed ? (
                  <span className="sr-only">{user.name}</span>
                ) : (
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-normal truncate">
                      {user.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground truncate">
                      {user.email}
                    </span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align={collapsed ? "end" : "start"}
              className={cn("mb-2", collapsed ? "w-56" : "w-(--radix-dropdown-menu-trigger-width)")}
            >
              <DropdownMenuLabel className="font-normal py-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="py-2.5">
                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <User className="size-4" strokeWidth={1.75} />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer py-2.5 gap-3"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}

export function Sidebar({
  className,
  collapsed = false,
  ...props
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full shrink-0 bg-sidebar border-r border-sidebar-border transition-[width]",
        collapsed ? "w-14" : "w-[228px]",
        className
      )}
    >
      <SidebarContent {...props} collapsed={collapsed} />
    </aside>
  );
}

export function MobileSidebar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);

  const handleOpenCommand = props.onOpenCommand
    ? () => {
        setOpen(false);
        props.onOpenCommand?.();
      }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden size-8 text-muted-foreground hover:text-foreground"
        >
          <Menu className="size-4" strokeWidth={1.75} />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[228px] p-0 bg-sidebar border-r border-sidebar-border"
      >
        <div className="flex flex-col h-full">
          <SidebarContent
            {...props}
            onOpenCommand={handleOpenCommand}
            collapsed={false}
            inSheet={true}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardSidebar(props: SidebarProps) {
  return (
    <>
      <Sidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
}
