"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { performanceRanges } from "@/modules/agents/performance-ranges";
import type { AgentPerformanceRange } from "@/modules/agents/performance";

export function PerformanceRangeSelector({
  currentRange,
  username,
}: {
  currentRange: AgentPerformanceRange;
  username: string;
}) {
  const activeRange =
    performanceRanges.find((range) => range.value === currentRange) ||
    performanceRanges[4];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {activeRange.label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[80] w-56 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/15 outline-none"
        >
          {performanceRanges.map((range) => {
            const isActive = range.value === currentRange;

            return (
              <DropdownMenu.Item key={range.value} asChild>
                <Link
                  href={`/users/${username}/performance?range=${range.value}`}
                  scroll={false}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-bold outline-none transition-colors hover:bg-accent focus:bg-accent",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
                  )}
                >
                  {range.label}
                  {isActive ? <Check className="size-4" /> : null}
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
