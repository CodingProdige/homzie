"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageTopBar({
  actions,
  backButtonClassName,
  backButtonLabel,
  children,
  className,
  mobileActions,
}: {
  actions?: ReactNode;
  backButtonClassName?: string;
  backButtonLabel?: string;
  children?: ReactNode;
  className?: string;
  mobileActions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-40 flex w-full min-w-0 items-center justify-between gap-2 bg-background/92 py-3 text-foreground backdrop-blur-xl sm:gap-4",
        className,
      )}
    >
      <div className="shrink-0">
        {children || (
          <BackButton
            className={cn(
              "text-foreground hover:text-primary",
              backButtonClassName,
            )}
            label={backButtonLabel}
          />
        )}
      </div>
      {actions ? (
        <div
          className={cn(
            "min-w-0 items-center justify-end gap-3",
            mobileActions ? "hidden sm:flex sm:flex-wrap" : "flex flex-wrap",
          )}
        >
          {actions}
        </div>
      ) : null}
      {mobileActions ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 px-3 text-xs font-semibold sm:hidden"
            >
              <MoreHorizontal className="size-4" />
              Actions
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-44 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
            >
              {mobileActions}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </div>
  );
}

export function PageTopBarMenuItem({
  children,
  className,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      className={cn(
        "flex min-h-9 cursor-pointer select-none items-center rounded-md px-3 text-sm font-bold outline-none transition-colors hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      onSelect={onSelect}
    >
      {children}
    </DropdownMenu.Item>
  );
}
