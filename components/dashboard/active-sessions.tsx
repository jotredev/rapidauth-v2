"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  Monitor,
  Smartphone,
  Laptop,
  Globe,
  MapPin,
  Clock,
  LogOut,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";
import { revokeSession, revokeAllOtherSessions } from "@/actions/sessions";

export interface SessionData {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface ActiveSessionsProps {
  sessions: SessionData[];
  total?: number;
  onSessionRevoked?: () => void;
}

function getDeviceInfo(userAgent: string | null): {
  type: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
} {
  if (!userAgent) {
    return { type: "desktop", browser: "Unknown", os: "Unknown" };
  }

  const ua = userAgent.toLowerCase();

  let type: "desktop" | "mobile" | "tablet" = "desktop";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    type = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    type = "tablet";
  }

  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  return { type, browser, os };
}

function DeviceIcon({ type }: { type: "desktop" | "mobile" | "tablet" }) {
  switch (type) {
    case "mobile":
      return <Smartphone className="h-5 w-5" strokeWidth={1.5} />;
    case "tablet":
      return <Laptop className="h-5 w-5" strokeWidth={1.5} />;
    default:
      return <Monitor className="h-5 w-5" strokeWidth={1.5} />;
  }
}

function SessionItem({
  session,
  onRevoke,
  isRevoking,
}: {
  session: SessionData;
  onRevoke: (sessionId: string) => Promise<void>;
  isRevoking: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const deviceInfo = getDeviceInfo(session.userAgent);
  const isExpired = new Date(session.expiresAt) < new Date();

  return (
    <div
      className={`flex items-start gap-4 p-4 border border-border rounded-lg ${
        session.isCurrent ? "bg-primary/5 border-primary/20" : ""
      }`}
    >
      <div
        className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
          session.isCurrent
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <DeviceIcon type={deviceInfo.type} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">
            {deviceInfo.browser} on {deviceInfo.os}
          </p>
          {session.isCurrent && (
            <Badge variant="default" className="text-xs">
              Current session
            </Badge>
          )}
          {isExpired && (
            <Badge variant="destructive" className="text-xs">
              Expired
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          {session.ipAddress && session.ipAddress !== "unknown" && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {session.ipAddress === "::1" ||
              session.ipAddress === "127.0.0.1" ||
              session.ipAddress.startsWith("0000:0000")
                ? "localhost"
                : session.ipAddress}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            Started{" "}
            {formatDistanceToNow(new Date(session.createdAt), {
              addSuffix: true,
              locale: enUS,
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
            Expires{" "}
            {formatDistanceToNow(new Date(session.expiresAt), {
              addSuffix: true,
              locale: enUS,
            })}
          </span>
        </div>
      </div>

      {!session.isCurrent && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={isRevoking}
            onClick={() => setConfirmOpen(true)}
            aria-label="Revoke remote session"
          >
            {isRevoking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Revoke remote session"
            description="Are you sure you want to revoke this session? The device will be signed out immediately."
            confirmLabel="Revoke session"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={() => onRevoke(session.id)}
          />
        </>
      )}
    </div>
  );
}

export function ActiveSessions({
  sessions,
  total,
  onSessionRevoked,
}: ActiveSessionsProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [localSessions, setLocalSessions] = React.useState(sessions);
  const [prevSessions, setPrevSessions] = React.useState(sessions);
  const [revokedCount, setRevokedCount] = React.useState(0);
  const [confirmAllOpen, setConfirmAllOpen] = React.useState(false);

  if (sessions !== prevSessions) {
    setPrevSessions(sessions);
    setLocalSessions(sessions);
    setRevokedCount(0);
  }

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    const result = await revokeSession(sessionId);

    if (result.response === 'error') {
      toast.error(result.message);
      setRevokingId(null);
      return;
    }

    setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setRevokedCount((prev) => prev + 1);
    toast.success(result.message);
    onSessionRevoked?.();
    setRevokingId(null);
  };

  const handleRevokeAllOtherSessions = async () => {
    setIsLoading(true);
    const result = await revokeAllOtherSessions();

    if (result.response === 'error') {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    const revokedAmount = localSessions.filter((s) => !s.isCurrent).length;
    setLocalSessions((prev) => prev.filter((s) => s.isCurrent));
    setRevokedCount((prev) => prev + revokedAmount);
    toast.success(result.message);
    onSessionRevoked?.();
    setIsLoading(false);
  };

  const otherSessionsCount = localSessions.filter((s) => !s.isCurrent).length;
  const effectiveTotal = Math.max(
    0,
    (total ?? (localSessions.length + revokedCount)) - revokedCount,
  );

  return (
    <Card className="gap-y-0 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold mb-1">Active Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Manage your active sessions across all devices.
          </p>
        </div>
        {otherSessionsCount > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={isLoading}
              onClick={() => setConfirmAllOpen(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldAlert className="h-4 w-4 mr-2" strokeWidth={1.5} />
              )}
              Revoke other sessions
            </Button>

            <ConfirmDialog
              open={confirmAllOpen}
              onOpenChange={setConfirmAllOpen}
              title="Revoke all other sessions"
              description={`Are you sure you want to revoke every session except the current one? This will sign out ${otherSessionsCount} ${otherSessionsCount === 1 ? "device" : "devices"}.`}
              confirmLabel="Revoke all"
              cancelLabel="Cancel"
              variant="destructive"
              onConfirm={handleRevokeAllOtherSessions}
            />
          </>
        )}
      </div>

      <div className="space-y-3">
        {localSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-sm">No active sessions.</p>
          </div>
        ) : (
          localSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onRevoke={handleRevokeSession}
              isRevoking={revokingId === session.id}
            />
          ))
        )}
      </div>

      {localSessions.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          {effectiveTotal}{" "}
          {effectiveTotal === 1 ? "active session" : "active sessions"} total
        </p>
      )}
    </Card>
  );
}
