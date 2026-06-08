"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  BarChart3,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";

type AdminShellProps = {
  adminEmail: string;
  children: ReactNode;
};

const adminNavItems: Array<{
  href: string;
  icon: LucideIcon;
  label: string;
}> = [
  { href: "/admin", icon: BarChart3, label: "Dashboard" },
  { href: "/admin/users", icon: UsersRound, label: "Users" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

function AdminHomeButton({ compact = false }: { compact?: boolean }) {
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

function AdminNav({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav className="space-y-1" aria-label="Admin pages">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex h-11 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none",
              isActive &&
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

function AdminSidebar({
  adminEmail,
  pathname,
}: {
  adminEmail: string;
  pathname: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-border bg-background px-4 py-5 lg:flex lg:flex-col">
      <Link href="/admin" className="flex items-center gap-3 px-2" aria-label="Admin dashboard">
        <HomzieLogo variant="mark" className="size-9" priority />
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight">Homzie Admin</p>
          <p className="truncate text-xs font-semibold text-muted-foreground">
            Operations
          </p>
        </div>
      </Link>

      <div className="mt-6 rounded-lg border border-primary/20 bg-primary/8 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-primary">
              Admin clearance
            </p>
            <p className="truncate text-xs font-black">{adminEmail}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <AdminNav pathname={pathname} />
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <AdminHomeButton />
      </div>
    </aside>
  );
}

export function AdminShell({ adminEmail, children }: AdminShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AdminSidebar adminEmail={adminEmail} pathname={pathname} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open admin menu">
                <Menu className="size-5" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px] lg:hidden" />
              <Dialog.Content className="fixed bottom-0 left-0 top-0 z-[90] flex w-[min(84vw,22rem)] flex-col border-r border-border bg-background text-foreground shadow-2xl outline-none lg:hidden">
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <Dialog.Title className="text-base font-black">
                    Admin menu
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Navigate between admin dashboard pages and return to Homzie.
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close admin menu">
                      <X className="size-5" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="border-b border-border px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-primary">
                        Admin clearance
                      </p>
                      <p className="truncate text-xs font-black">{adminEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                  <AdminNav
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
                  <AdminHomeButton />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <HomzieLogo variant="mark" className="size-7" priority />
            <span className="truncate text-sm font-black">Homzie Admin</span>
          </Link>

          <AdminHomeButton compact />
        </header>

        {children}
      </div>
    </div>
  );
}
