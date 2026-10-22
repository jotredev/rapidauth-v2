"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LogIn,
  LogOut,
  UserPlus,
  KeyRound,
  Mail,
  Image,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
  MailCheck,
  Link as LinkIcon,
  XCircle,
  PenLine,
  Monitor,
  Smartphone,
  Laptop,
  Clock,
  MapPin,
  ScrollText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export interface ActivityLogEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ActivityLogProps {
  activities: ActivityLogEntry[];
  isLoading?: boolean;
}

const getActionConfig = (action: string) => {
  const configs: Record<
    string,
    {
      icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
    }
  > = {
    login: {
      icon: LogIn,
      label: "Inicio de sesión",
      variant: "default",
      color: "text-green-500",
    },
    logout: {
      icon: LogOut,
      label: "Cierre de sesión",
      variant: "secondary",
      color: "text-muted-foreground",
    },
    register: {
      icon: UserPlus,
      label: "Registro de cuenta",
      variant: "default",
      color: "text-blue-500",
    },
    terms_accepted: {
      icon: ScrollText,
      label: "Terms accepted",
      variant: "outline",
      color: "text-blue-500",
    },
    profile_update: {
      icon: PenLine,
      label: "Perfil actualizado",
      variant: "outline",
      color: "text-amber-500",
    },
    password_change: {
      icon: KeyRound,
      label: "Contraseña cambiada",
      variant: "secondary",
      color: "text-orange-500",
    },
    email_change: {
      icon: Mail,
      label: "Email cambiado",
      variant: "outline",
      color: "text-blue-400",
    },
    avatar_change: {
      icon: Image,
      label: "Avatar actualizado",
      variant: "outline",
      color: "text-purple-500",
    },
    "2fa_enabled": {
      icon: ShieldCheck,
      label: "2FA activado",
      variant: "default",
      color: "text-green-500",
    },
    "2fa_disabled": {
      icon: ShieldOff,
      label: "2FA desactivado",
      variant: "destructive",
      color: "text-red-500",
    },
    "2fa_verified": {
      icon: ShieldQuestion,
      label: "2FA verificado",
      variant: "secondary",
      color: "text-green-400",
    },
    email_verified: {
      icon: MailCheck,
      label: "Email verificado",
      variant: "default",
      color: "text-green-500",
    },
    oauth_login: {
      icon: LinkIcon,
      label: "Inicio con OAuth",
      variant: "outline",
      color: "text-indigo-500",
    },
    oauth_link: {
      icon: LinkIcon,
      label: "Cuenta OAuth vinculada",
      variant: "outline",
      color: "text-indigo-400",
    },
    session_revoked: {
      icon: XCircle,
      label: "Sesión revocada",
      variant: "destructive",
      color: "text-red-500",
    },
  };

  return (
    configs[action] || {
      icon: PenLine,
      label: action,
      variant: "outline" as const,
      color: "text-muted-foreground",
    }
  );
};

const getBrowserInfo = (userAgent: string | null): string => {
  if (!userAgent) return "Navegador desconocido";
  const ua = userAgent.toLowerCase();

  if (ua.includes("chrome") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";

  return "Navegador";
};

const getOSInfo = (userAgent: string | null): string => {
  if (!userAgent) return "";
  const ua = userAgent.toLowerCase();

  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";

  return "";
};

function DeviceIconComponent({ userAgent }: { userAgent: string | null }) {
  if (!userAgent) return <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} />;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="h-3.5 w-3.5" strokeWidth={1.5} />;
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return <Laptop className="h-3.5 w-3.5" strokeWidth={1.5} />;
  }
  return <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} />;
}

function ActivityItem({ activity }: { activity: ActivityLogEntry }) {
  const config = getActionConfig(activity.action);
  const Icon = config.icon;
  const browser = getBrowserInfo(activity.userAgent);
  const os = getOSInfo(activity.userAgent);
  const deviceInfo = [browser, os].filter(Boolean).join(" · ");

  const details = activity.details as Record<string, string> | null;
  const provider = details?.provider;
  const field = details?.field;
  const newValue = details?.newValue;

  return (
    <div className="flex gap-4 py-4 border-b border-border last:border-0">
      <div
        className={`flex-shrink-0 h-10 w-10 rounded-full bg-secondary flex items-center justify-center ${config.color}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">
              {config.label}
              {provider && (
                <Badge variant="outline" className="ml-2 text-xs capitalize">
                  {provider}
                </Badge>
              )}
            </p>
            {field && newValue && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {field}: {newValue}
              </p>
            )}
          </div>
          <Badge variant={config.variant} className="shrink-0 text-xs">
            {config.label.split(" ")[0]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {formatDistanceToNow(new Date(activity.createdAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>

          {activity.ipAddress && activity.ipAddress !== "unknown" && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {activity.ipAddress}
            </span>
          )}

          {deviceInfo && (
            <span className="flex items-center gap-1.5">
              <DeviceIconComponent userAgent={activity.userAgent} />
              {deviceInfo}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-4 py-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ActivityLog({ activities, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return (
      <Card className="gap-y-0 p-6">
        <h3 className="text-[15px] font-semibold mb-1">Registro de Actividad</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Historial de acciones en tu cuenta.
        </p>
        <div className="space-y-0">
          {[...Array(5)].map((_, i) => (
            <ActivitySkeleton key={i} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-y-0 p-6">
      <h3 className="text-[15px] font-semibold mb-1">Registro de Actividad</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Historial de acciones en tu cuenta.
      </p>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
          <p className="text-sm">No hay actividad registrada aún.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </Card>
  );
}
