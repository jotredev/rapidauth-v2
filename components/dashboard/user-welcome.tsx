"use client";

import { PageHeader } from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Settings, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

interface UserWelcomeProps {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    twoFactorEnabled: boolean;
  };
}

export function UserWelcome({ user }: UserWelcomeProps) {
  const quickActions = [
    {
      title: "Profile Settings",
      description: "Update your personal information and preferences",
      icon: User,
      href: "/dashboard/profile",
    },
    {
      title: "Security",
      description: "Manage your password and two-factor authentication",
      icon: Shield,
      href: "/dashboard/profile",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Your personal dashboard overview."
      />

      <div className="flex flex-col gap-6 p-5">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full bg-gradient-to-br from-primary/10 via-background to-background ring-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">Account Overview</CardTitle>
              <CardDescription>Your account information at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{user.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${user.emailVerified ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <p className="font-medium">{user.emailVerified ? "Verified" : "Pending"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{user.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">2FA Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${user.twoFactorEnabled ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <p className="font-medium">{user.twoFactorEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {quickActions.map((action) => (
            <Card key={action.title} className="group hover:ring-primary/40 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <action.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-base mt-4">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto" asChild>
                  <Link href={action.href}>
                    <span className="text-sm text-primary">Go to {action.title.toLowerCase()}</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Need Help?</CardTitle>
                <CardDescription>Access resources and support</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions or need assistance, visit your profile settings or contact our support team.
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/profile">
                Manage Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
