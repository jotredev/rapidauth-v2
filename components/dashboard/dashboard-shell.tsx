"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  type NavItem,
  type NavSection,
  type UserProfile,
} from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { signOut } from "@/actions/auth";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Activity,
  ScrollText,
  LifeBuoy,
} from "lucide-react";

function getNavigation(isAdmin: boolean): NavSection[] {
  const sections: NavSection[] = [
    {
      items: [
        { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
  ];

  // Only admins get this section; its title is the indicator.
  if (isAdmin) {
    sections.push({
      title: "Admin",
      items: [
        { title: "Users", href: "/dashboard/users", icon: Users },
        { title: "Activity", href: "/dashboard/activity", icon: Activity },
        { title: "System logs", href: "/dashboard/logs", icon: ScrollText },
      ],
    });
  }

  return sections;
}

// Pinned above the user menu, which already links to Profile.
const FOOTER_ITEMS: NavItem[] = [
  { title: "Support", href: "/support", icon: LifeBuoy },
];

// Profile stays reachable from the command palette (⌘K).
const PROFILE_PAGE: NavItem = {
  title: "Profile",
  href: "/dashboard/profile",
  icon: UserCircle,
};

interface DashboardShellProps {
  children: React.ReactNode;
  user?: UserProfile;
  brandName?: string;
  version?: string;
  hasAdminAccess?: boolean;
}

export function DashboardShell({
  children,
  user = {
    name: "Admin User",
    email: "admin@example.com",
    role: "Admin",
  },
  brandName = "rapidauth",
  version,
  hasAdminAccess = false,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const navigation = getNavigation(hasAdminAccess);
  const pages = [
    ...navigation.flatMap((s) => s.items),
    PROFILE_PAGE,
    ...FOOTER_ITEMS,
  ];

  const sidebarProps = {
    brandName,
    version,
    navigation,
    footerItems: FOOTER_ITEMS,
    user,
    onLogout: handleLogout,
    onOpenCommand: () => setCommandOpen(true),
  };

  const pathname = usePathname();
  const showDateRange = hasAdminAccess && pathname === '/dashboard';

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <CommandPalette
        pages={pages}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onLogout={handleLogout}
      />
      <Sidebar {...sidebarProps} collapsed={collapsed} />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          sidebarProps={sidebarProps}
          pages={pages}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
          showDateRange={showDateRange}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col">{children}</div>
        </div>
      </main>
    </div>
  );
}
