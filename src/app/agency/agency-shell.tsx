"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ClipboardCheck,
  CreditCard,
  ListOrdered,
  Home,
  Menu,
  Network,
  Radar,
  Settings,
  ShieldCheck,
  TowerControl,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";

type AgencyShellProps = {
  accountLabel: string;
  activityCount?: number;
  agencyType?: "branch" | "independent" | "network";
  basePath?: string;
  children: ReactNode;
  controlRoomLogoUrl?: string | null;
  roomLabel?: string;
  workspaceLabel: string;
};

function agencyNavItems(
  basePath: string,
  agencyType: AgencyShellProps["agencyType"],
  activityCount: number,
): Array<{
  badgeCount?: number;
  href?: string;
  icon: LucideIcon;
  label: string;
  planned?: boolean;
}> {
  const items: Array<{
    badgeCount?: number;
    href?: string;
    icon: LucideIcon;
    label: string;
    planned?: boolean;
  }> = [{ href: basePath, icon: BarChart3, label: "Dashboard" }];

  if (agencyType === "network") {
    items.push({ href: `${basePath}/branches`, icon: Network, label: "Branches" });
  }

  if (agencyType === "branch" || agencyType === "independent") {
    items.push({ href: `${basePath}/network`, icon: Network, label: "Network" });
  }

  items.push(
    { href: `${basePath}/leaderboard`, icon: ListOrdered, label: "Leaderboard" },
    { badgeCount: activityCount, href: `${basePath}/activity`, icon: Bell, label: "Activity" },
    { href: `${basePath}/members`, icon: UsersRound, label: "Members" },
    { href: `${basePath}/employees`, icon: ShieldCheck, label: "Employees" },
    { icon: ClipboardCheck, label: "Listing Requests", planned: true },
    { icon: Radar, label: "Buyer Activity", planned: true },
    { icon: CreditCard, label: "Billing", planned: true },
    { href: `${basePath}/settings`, icon: Settings, label: "Settings" },
  );

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

function agencyTypeLabel(agencyType: AgencyShellProps["agencyType"]) {
  if (agencyType === "network") return "Network HQ";
  if (agencyType === "branch") return "Branch agency";

  return "Independent agency";
}

function roleLabel(accountLabel: string) {
  const [, role] = accountLabel.split(/[•·]/).map((part) => part.trim());

  return role || accountLabel;
}

function AgencyNav({
  activityCount,
  agencyType,
  basePath,
  onNavigate,
  pathname,
}: {
  agencyType: AgencyShellProps["agencyType"];
  activityCount: number;
  basePath: string;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav className="space-y-1" aria-label="Agency pages">
      {agencyNavItems(basePath, agencyType, activityCount).map((item) => {
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
            {item.badgeCount ? (
              <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                {item.badgeCount > 99 ? "99+" : item.badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AgencyWorkspaceIdentity({
  accountLabel,
  agencyType,
  basePath,
  controlRoomLogoUrl,
  roomLabel,
  workspaceLabel,
}: {
  accountLabel: string;
  agencyType: AgencyShellProps["agencyType"];
  basePath: string;
  controlRoomLogoUrl?: string | null;
  roomLabel: string;
  workspaceLabel: string;
}) {
  return (
    <Link
      href={basePath}
      className="block rounded-lg border border-primary/20 bg-primary/8 p-3 outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/25"
      aria-label={`${workspaceLabel} ${roomLabel}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-black text-primary-foreground">
          {controlRoomLogoUrl ? (
            <Image
              src={controlRoomLogoUrl}
              alt=""
              width={36}
              height={36}
              className="size-full object-cover"
            />
          ) : (
            <TowerControl className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-primary">
            {agencyTypeLabel(agencyType)}
          </p>
          <p className="truncate text-sm font-black leading-tight">{workspaceLabel}</p>
          <p className="truncate text-[11px] font-bold text-muted-foreground">
            {roleLabel(accountLabel)} access
          </p>
        </div>
      </div>
    </Link>
  );
}

function AgencySidebar({
  accountLabel,
  activityCount,
  agencyType,
  basePath,
  controlRoomLogoUrl,
  pathname,
  roomLabel,
  workspaceLabel,
}: {
  accountLabel: string;
  activityCount: number;
  agencyType: AgencyShellProps["agencyType"];
  basePath: string;
  controlRoomLogoUrl?: string | null;
  pathname: string;
  roomLabel: string;
  workspaceLabel: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-border bg-background px-4 py-5 lg:flex lg:flex-col">
      <div>
        <AgencyWorkspaceIdentity
          accountLabel={accountLabel}
          agencyType={agencyType}
          basePath={basePath}
          controlRoomLogoUrl={controlRoomLogoUrl}
          roomLabel={roomLabel}
          workspaceLabel={workspaceLabel}
        />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <AgencyNav
          activityCount={activityCount}
          agencyType={agencyType}
          basePath={basePath}
          pathname={pathname}
        />
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
  activityCount = 0,
  agencyType = "independent",
  basePath = "/controlroom",
  children,
  controlRoomLogoUrl,
  roomLabel = "Control room",
  workspaceLabel,
}: AgencyShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AgencySidebar
        accountLabel={accountLabel}
        activityCount={activityCount}
        agencyType={agencyType}
        basePath={basePath}
        controlRoomLogoUrl={controlRoomLogoUrl}
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
                  <AgencyWorkspaceIdentity
                    accountLabel={accountLabel}
                    agencyType={agencyType}
                    basePath={basePath}
                    controlRoomLogoUrl={controlRoomLogoUrl}
                    roomLabel={roomLabel}
                    workspaceLabel={workspaceLabel}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                  <AgencyNav
                    activityCount={activityCount}
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
            <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-primary/10 text-xs font-black text-primary">
              {controlRoomLogoUrl ? (
                <Image
                  src={controlRoomLogoUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="size-full object-cover"
                />
              ) : (
                <TowerControl className="size-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black leading-tight">
                {workspaceLabel}
              </span>
              <span className="block truncate text-[10px] font-black uppercase tracking-[0.08em] text-primary">
                {agencyTypeLabel(agencyType)}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/activity`}
              className="relative grid size-10 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              aria-label="Control room activity"
            >
              <Bell className="size-5" />
              {activityCount ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                  {activityCount > 99 ? "99+" : activityCount}
                </span>
              ) : null}
            </Link>
            <AgencyHomeButton compact />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
