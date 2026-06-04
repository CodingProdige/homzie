"use client";

import type { ReactNode } from "react";

import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";

export function SettingsPageHeader({
  actions,
  className,
  message,
  messageTone = "neutral",
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: string;
  message?: ReactNode;
  messageTone?: "neutral" | "success" | "error";
  title: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 -mx-4 flex min-w-0 shrink-0 flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:flex-row lg:items-center lg:justify-between lg:px-10",
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-3">
        <BackButton
          showLabel={false}
          className="grid size-8 shrink-0 place-items-center text-foreground hover:text-primary"
          iconClassName="size-4"
        />
        <h1 className="min-w-0 truncate text-center text-base font-bold leading-tight tracking-normal">
          {title}
        </h1>
        <span aria-hidden="true" />
      </div>

      {(message || actions) ? (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {message ? (
            <p
              className={cn(
                "max-w-full rounded-lg border px-4 py-2 text-sm font-bold lg:max-w-80",
                messageTone === "success"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : messageTone === "error"
                    ? "border-destructive/25 bg-destructive/10 text-destructive"
                    : "border-border bg-card text-foreground",
              )}
            >
              {message}
            </p>
          ) : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
