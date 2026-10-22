"use client";

import * as React from "react";
import { PageHeader } from "@/components/dashboard";
import { TableFooter } from "@/components/dashboard/table-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Lock, Camera, Save, Shield, History, Monitor } from "lucide-react";
import { TwoFactorStatus } from "./two-factor-setup";
import { ActivityLog, type ActivityLogEntry } from "./activity-log";
import { ActiveSessions, type SessionData } from "./active-sessions";
import { AccountDeletionDialog } from "./account-deletion-dialog";
import { changePasswordAction, updateProfileAction, uploadAvatarAction } from "@/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PageSize } from "@/lib/list-pagination";
import {
  buildProfileQueryString,
  type ProfileListParams,
  type ProfileTab,
} from "@/lib/profile-query";

interface ProfileData {
  name: string;
  email: string;
  avatar?: string;
}

interface ProfileContentProps {
  initialProfile: ProfileData;
  twoFactorEnabled?: boolean;
  isOAuthUser?: boolean;
  hasPassword?: boolean;
  activityLogs?: ActivityLogEntry[];
  sessions?: SessionData[];
  initialParams: ProfileListParams;
  activityPage: number;
  activityTotalPages: number;
  sessionsTotal: number;
  sessionsPage: number;
  sessionsTotalPages: number;
  pageSize: PageSize;
}

export function ProfileContent({
  initialProfile,
  twoFactorEnabled = false,
  isOAuthUser = false,
  hasPassword = !isOAuthUser,
  activityLogs = [],
  sessions = [],
  initialParams,
  activityPage,
  activityTotalPages,
  sessionsTotal,
  sessionsPage,
  sessionsTotalPages,
  pageSize,
}: ProfileContentProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = React.useState(twoFactorEnabled);
  const [isPending, startTransition] = React.useTransition();
  const [tab, setTab] = React.useState<ProfileTab>(initialParams.tab);
  const [prevTab, setPrevTab] = React.useState<ProfileTab>(initialParams.tab);

  if (initialParams.tab !== prevTab) {
    setPrevTab(initialParams.tab);
    setTab(initialParams.tab);
  }

  const router = useRouter();

  const href = React.useCallback((next: ProfileListParams) => {
    const qs = buildProfileQueryString(next);
    return qs ? `/dashboard/profile?${qs}` : '/dashboard/profile';
  }, []);

  const navigate = React.useCallback(
    (next: ProfileListParams) => {
      startTransition(() => {
        router.replace(href(next), { scroll: false });
      });
    },
    [href, router],
  );

  const [profile, setProfile] = React.useState(initialProfile);

  const [passwords, setPasswords] = React.useState({
    current: "",
    new: "",
    confirm: "",
  });

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const result = await updateProfileAction({ name: profile.name });
      if (result.response === 'error') {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setIsLoading(true);
    try {
      const result = await changePasswordAction({
        currentPassword: passwords.current,
        newPassword: passwords.new,
        confirmPassword: passwords.confirm,
      });

      if (result.response === 'error') {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setPasswords({ current: "", new: "", confirm: "" });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your account settings and preferences."
      />

      <div className="flex flex-col gap-6 p-5">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            const next = value as ProfileTab;
            setTab(next);
            navigate({ ...initialParams, tab: next });
          }}
          className="w-full"
        >
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="general" className="gap-2">
            <User className="h-4 w-4" strokeWidth={1.5} />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" strokeWidth={1.5} />
              Security
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" strokeWidth={1.5} />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History className="h-4 w-4" strokeWidth={1.5} />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="gap-y-0 p-6">
            <h3 className="text-lg font-medium mb-1">Profile Information</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Update your personal details and profile picture.
            </p>

            <div className="flex items-center gap-6 mb-8">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback className="text-lg bg-secondary">
                  {profile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  id="avatar-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 4 * 1024 * 1024) {
                      toast.error('File too large. Maximum size is 4MB.');
                      return;
                    }

                    setIsLoading(true);
                    const formData = new FormData();
                    formData.append('avatar', file);

                    const result = await uploadAvatarAction(formData);
                    if (result.response === 'error') {
                      toast.error(result.message);
                    } else {
                      toast.success(result.message);
                      if (result.data?.imageUrl) {
                        setProfile({ ...profile, avatar: result.data.imageUrl });
                      }
                      router.refresh();
                    }
                    setIsLoading(false);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isLoading}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <Camera className="h-4 w-4" strokeWidth={1.5} />
                  {isLoading ? 'Uploading...' : 'Change Photo'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF or WEBP. Max 4MB.
                </p>
              </div>
            </div>

            <Separator className="mb-6" />

            <div className="grid gap-6 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="pl-10"
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {isOAuthUser && (
                  <p className="text-xs text-muted-foreground">Managed by your authentication provider. Cannot be changed.</p>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="pl-10"
                    placeholder="your@email.com"
                    disabled={isOAuthUser}
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={isLoading}
                className="w-fit gap-2"
              >
                <Save className="h-4 w-4" strokeWidth={1.5} />
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {hasPassword && <>
          <Card className="gap-y-0 p-6">
              <h3 className="text-lg font-medium mb-1">Change Password</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Update your password to keep your account secure.
              </p>

              <div className="grid gap-6 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input
                      id="current-password"
                      type="password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="pl-10"
                      placeholder="Enter current password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input
                      id="new-password"
                      type="password"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="pl-10"
                      placeholder="Enter new password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="pl-10"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isLoading || !passwords.current || !passwords.new || passwords.new !== passwords.confirm}
                  className="w-fit gap-2"
                >
                  <Shield className="h-4 w-4" strokeWidth={1.5} />
                  {isLoading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </Card>
          <Card className="gap-y-0 p-6">
            <h3 className="text-lg font-medium mb-1">Two-Factor Authentication</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Add an extra layer of security to your account.
            </p>

            <TwoFactorStatus
              enabled={is2FAEnabled}
              onStatusChange={setIs2FAEnabled}
            />
          </Card>
          </>}
          <AccountDeletionDialog hasPassword={hasPassword} />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <ActiveSessions
            sessions={sessions}
            total={sessionsTotal}
            onSessionRevoked={() => router.refresh()}
          />
          <TableFooter
            page={sessionsPage}
            totalPages={sessionsTotalPages}
            pageSize={pageSize}
            isPending={isPending}
            getPageHref={(p) =>
              href({ ...initialParams, tab: 'sessions', sessionsPage: p })
            }
            onPageChange={(p) =>
              navigate({ ...initialParams, tab: 'sessions', sessionsPage: p })
            }
            onPageSizeChange={(s) =>
              navigate({
                ...initialParams,
                tab: 'sessions',
                pageSize: s,
                activityPage: 1,
                sessionsPage: 1,
              })
            }
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <ActivityLog activities={activityLogs} />
          <TableFooter
            page={activityPage}
            totalPages={activityTotalPages}
            pageSize={pageSize}
            isPending={isPending}
            getPageHref={(p) =>
              href({ ...initialParams, tab: 'activity', activityPage: p })
            }
            onPageChange={(p) =>
              navigate({ ...initialParams, tab: 'activity', activityPage: p })
            }
            onPageSizeChange={(s) =>
              navigate({
                ...initialParams,
                tab: 'activity',
                pageSize: s,
                activityPage: 1,
                sessionsPage: 1,
              })
            }
          />
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
