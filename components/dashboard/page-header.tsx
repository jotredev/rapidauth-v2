"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, type LucideIcon } from "lucide-react";

export interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ActionButton[];
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-2 border-b border-border px-5 py-2",
        className
      )}
    >
      <h1 className="text-[19px] font-semibold leading-tight">{title}</h1>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About this page"
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="size-[15px]" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      )}

      <div className="ml-auto flex items-center gap-2">
        {children}

        {actions?.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || "default"}
              size="sm"
              onClick={action.onClick}
              className="gap-2"
            >
              {Icon && <Icon className="size-4" strokeWidth={1.75} />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
