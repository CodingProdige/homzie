"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  CreditCard,
  ListOrdered,
  Home,
  Menu,
  Network,
  Radar,
  Settings,
  TowerControl,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";

type AgencyShellProps = {
  accountLabel: string;
  agencyType?: "branch" | "independent" | "network";
  basePath?: string;
  children: ReactNode;
  roomLabel?: string;
  workspaceLabel: string;
};

function agencyNavItems(
  basePath: string,
  agencyType: AgencyShellProps["agencyType"],
): Array<{
  href?: string;
  icon: LucideIcon;
  label: string;
  planned?: boolean;
}> {
  const items: Array<{
    href?: string;
    icon: LucideIcon;
    label: string;
    planned?: boolean;
  }> = [
    { href: basePath, icon: BarChart3, label: "Dashboard" },
    { icon: UsersRound, label: "Members", planned: true },
    { icon: ClipboardCheck, label: "Listing Requests", planned: true },
    { icon: Radar, label: "Buyer Activity", planned: true },
    { icon: CreditCard, label: "Billing", planned: true },
    { href: `${basePath}/settings`, icon: Settings, label: "Settings" },
  ];

  if (agencyType === "network") {
    items.splice(1, 0, { href: `${basePath}/branches`, icon: Network, label: "Branches" });
  }

  if (agencyType === "network" || agencyType === "branch") {
    items.splice(
      agencyType === "network" ? 2 : 1,
      0,
      { href: `${basePath}/leaderboard`, icon: ListOrdered, label: "Leaderboard" },
    );
  }

  return items;
}

function AgencyHomeButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button asChild className={cn("w-full", compact && "w-auto px-3")}>
      <Link href="/" replace>
        {compact ? <Home className="size-4" /> : <ArrowLeft className="size-4" />}
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
          Back to Homzie
        </span>
      </Link>
    </Button>
  );
}

function AgencyNav({
  agencyType,
  basePath,
  onNavigate,
  pathname,
}: {
  agencyType: AgencyShellProps["agencyType"];
  basePath: string;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav className="space-y-1" aria-label="Agency pages">
      {agencyNavItems(basePath, agencyType).map((item) => {
        const Icon = item.icon;

        if (!item.href) {
          return (
            <div
              key={item.label}
              className="flex h-11 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-bold text-muted-foreground/60"
              title="Coming soon"
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
                Soon
              </span>
            </div>
          );
        }

        const isDashboardActive =
          item.href === basePath
            ? pathname === basePath
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isDashboardActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex h-11 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none",
              isDashboardActive &&
                "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary focus-visible:bg-primary/15 focus-visible:text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AgencyIdentityCard({
  accountLabel,
  workspaceLabel,
}: {
  accountLabel: string;
  workspaceLabel: string;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/8 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <TowerControl className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-primary">
            Agency access
          </p>
          <p className="truncate text-xs font-black">{workspaceLabel}</p>
          <p className="truncate text-[11px] font-semibold text-muted-foreground">
            {accountLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgencySidebar({
  accountLabel,
  agencyType,
  basePath,
  pathname,
  roomLabel,
  workspaceLabel,
}: {
  accountLabel: string;
  agencyType: AgencyShellProps["agencyType"];
  basePath: string;
  pathname: string;
  roomLabel: string;
  workspaceLabel: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-border bg-background px-4 py-5 lg:flex lg:flex-col">
      <Link href={basePath} className="flex items-center gap-3 px-2" aria-label="Control room dashboard">
        <HomzieLogo variant="mark" className="size-9" priority />
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight">Homzie Agency</p>
          <p className="truncate text-xs font-semibold text-muted-foreground">
            {roomLabel}
          </p>
        </div>
      </Link>

      <div className="mt-6">
        <AgencyIdentityCard
          accountLabel={accountLabel}
          workspaceLabel={workspaceLabel}
        />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <AgencyNav agencyType={agencyType} basePath={basePath} pathname={pathname} />
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <AgencyHomeButton />
      </div>
    </aside>
  );
}

export function AgencyShell({
  accountLabel,
  agencyType = "independent",
  basePath = "/controlroom",
  children,
  roomLabel = "Control room",
  workspaceLabel,
}: AgencyShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AgencySidebar
        accountLabel={accountLabel}
        agencyType={agencyType}
        basePath={basePath}
        pathname={pathname}
        roomLabel={roomLabel}
        workspaceLabel={workspaceLabel}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open agency menu">
                <Menu className="size-5" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px] lg:hidden" />
              <Dialog.Content className="fixed bottom-0 left-0 top-0 z-[90] flex w-[min(84vw,22rem)] flex-col border-r border-border bg-background text-foreground shadow-2xl outline-none lg:hidden">
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <Dialog.Title className="text-base font-black">
                    Agency menu
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Navigate between agency control room pages and return to Homzie.
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close agency menu">
                      <X className="size-5" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="border-b border-border px-4 py-4">
                  <AgencyIdentityCard
                    accountLabel={accountLabel}
                    workspaceLabel={workspaceLabel}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                  <AgencyNav
                    agencyType={agencyType}
                    basePath={basePath}
                    pathname={pathname}
                    onNavigate={() => setMenuOpen(false)}
                  />
                </div>
                <div className="space-y-4 border-t border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-muted-foreground">
                      Theme
                    </span>
                    <ThemeToggle />
                  </div>
                  <AgencyHomeButton />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Link href={basePath} className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <TowerControl className="size-4" />
            </span>
            <span className="truncate text-sm font-black">{workspaceLabel}</span>
          </Link>

          <AgencyHomeButton compact />
        </header>

        {children}
      </div>
    </div>
  );
}
