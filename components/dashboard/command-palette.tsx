"use client";

import * as React from "react";
import { useRouter } from "nextjs-toploader/app";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Sun, Moon, LogOut, type LucideIcon } from "lucide-react";

export interface CommandPalettePage {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface CommandPaletteProps {
  pages: CommandPalettePage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void | Promise<void>;
}

export function CommandPalette({
  pages,
  open,
  onOpenChange,
  onLogout,
}: CommandPaletteProps): React.JSX.Element {
  const router = useRouter();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to"
      description="Search pages and commands"
    >
      <Command>
        <CommandInput placeholder="Search pages and commands..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <CommandItem
                  key={page.href}
                  value={page.title}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(page.href);
                  }}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span>{page.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem
              value="Light theme"
              onSelect={() => {
                onOpenChange(false);
                setTheme("light");
              }}
            >
              <Sun className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Light theme</span>
            </CommandItem>
            <CommandItem
              value="Dark theme"
              onSelect={() => {
                onOpenChange(false);
                setTheme("dark");
              }}
            >
              <Moon className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Dark theme</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem
              value="Log out"
              onSelect={() => {
                onOpenChange(false);
                void onLogout();
              }}
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
              <span>Log out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
