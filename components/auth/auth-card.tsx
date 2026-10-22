"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function AuthBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-[17px] font-normal", className)}
    >
      <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
      <span>rapidauth</span>
    </Link>
  );
}

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Card className="gap-y-0 p-6">{children}</Card>

      {footer && (
        <div className="text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

interface AuthLinkProps {
  href: string;
  children: React.ReactNode;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
}

export function AuthLink({ href, children, target, rel }: AuthLinkProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className="text-link underline-offset-4 hover:underline font-normal"
    >
      {children}
    </Link>
  );
}
