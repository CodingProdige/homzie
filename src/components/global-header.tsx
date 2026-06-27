"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  Building2,
  Clapperboard,
  CircleHelp,
  Heart,
  Home,
  Menu,
  Radar,
  Send,
  ShieldCheck,
  TowerControl,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { CountryPreferenceSelector } from "@/components/country-preference-selector";
import { GlobalUserSearchTrigger } from "@/components/global-user-search";
import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";
import { CurrencySelector } from "@/modules/currency/currency-selector";
import { EventCountBadge } from "@/modules/events/components/event-count-badge";
import { ListingBuyerActivityCountBadge } from "@/modules/listings/components/listing-buyer-activity-count-badge";
import { MessageCountBadge } from "@/modules/messages/components/message-count-badge";
import { MessageRealtimePresence } from "@/modules/messages/components/message-realtime-presence";
import { InstallHomzieButton } from "@/modules/pwa/components/pwa-install";

const navItems: Array<{
  href: string;
  icon: LucideIcon;
  label: string;
}> = [
  { href: "/agents", icon: UsersRound, label: "Agents" },
  { href: "/reels", icon: Clapperboard, label: "Reels" },
  { href: "/listings", icon: Building2, label: "Listings" },
  { href: "/about", icon: CircleHelp, label: "About" },
  { href: "/contact", icon: Send, label: "Contact" },
];

export function GlobalHeader({
  transparentUntilScroll = false,
  viewerHasAgencyWorkspace = false,
  viewerRole,
  viewerUsername,
}: {
  transparentUntilScroll?: boolean;
  viewerHasAgencyWorkspace?: boolean;
  viewerRole?: "user" | "admin";
  viewerUsername?: string;
}) {
  const pathname = usePathname();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = !transparentUntilScroll || hasScrolled;
  const isActiveHref = (href: string) => {
    if (href === "/") return pathname === "/";
    if (
      href === "/listings" &&
      (pathname === "/listings/activity" || pathname.startsWith("/listings/activity/"))
    ) {
      return false;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const profileHref = viewerUsername ? `/users/${viewerUsername}` : "/sign-in";
  const messagesHref = "/messages";
  const eventsHref = viewerUsername ? "/events" : "/sign-in";
  const isProfileActive = isActiveHref(profileHref);
  const isMessagesActive = isActiveHref(messagesHref);
  const isEventsActive = isActiveHref("/events");
  const isAgencyActive = isActiveHref("/controlroom") || isActiveHref("/agency");
  const isAdmin = viewerRole === "admin";
  const isAdminActive = isActiveHref("/admin");
  const mobileItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
    },
    {
      label: "Messages",
      href: messagesHref,
      icon: Send,
    },
    {
      label: "Events",
      href: eventsHref,
      icon: Heart,
    },
    ...(viewerUsername
      ? [
          {
            label: "Listing buyers",
            href: "/listings/activity",
            icon: Radar,
          },
        ]
      : []),
    ...(viewerHasAgencyWorkspace
      ? [
          {
            label: "Agency HQ",
            href: "/controlroom",
            icon: TowerControl,
          },
        ]
      : []),
    ...navItems,
    ...(isAdmin
      ? [
          {
            label: "Admin",
            href: "/admin",
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      label: viewerUsername ? "Profile" : "Sign in",
      href: profileHref,
      icon: viewerUsername ? UserRound : Home,
    },
  ];

  useEffect(() => {
    if (!transparentUntilScroll) return;

    const updateScrolled = () => setHasScrolled(window.scrollY > 16);

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => window.removeEventListener("scroll", updateScrolled);
  }, [transparentUntilScroll]);

  return (
    <>
      <MessageRealtimePresence enabled={Boolean(viewerUsername)} />
      <header
        className={`fixed inset-x-0 top-0 z-[70] overflow-x-clip border-b transition-all duration-300 ${
          scrolled
            ? "border-border/70 bg-background/95 shadow-sm backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
      <div className="flex h-16 w-full min-w-0 items-center justify-between gap-2 px-3 sm:px-4 lg:h-20 lg:px-3">
        <Link
          href="/"
          className="flex shrink-0 items-center justify-start gap-3"
          aria-label="Homzie home"
        >
          <HomzieLogo
            variant="mark"
            className="size-7 sm:hidden"
            priority
          />
          <HomzieLogo
            variant="tight"
            className="hidden h-8 sm:block lg:h-11"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-10 text-sm font-semibold text-foreground lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveHref(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 py-2 transition-colors hover:text-primary",
                  isActive && "text-primary",
                )}
              >
                {item.label === "Reels" ? (
                  <Icon className="size-4 text-current" />
                ) : null}
                {item.label}
                {isActive ? (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 lg:gap-3">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <CountryPreferenceSelector compact className="shrink-0" />
          <CurrencySelector compact className="shrink-0" />
          <GlobalUserSearchTrigger className="hidden lg:inline-flex" />
          {viewerUsername ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className={cn(
                "hidden lg:inline-flex",
                isActiveHref("/listings/activity") && "bg-primary/10 text-primary",
              )}
              aria-label="Listing buyer activity"
            >
              <Link
                href="/listings/activity"
                aria-current={isActiveHref("/listings/activity") ? "page" : undefined}
                className="relative"
                title="Listing buyer activity"
              >
                <Radar className="size-5" />
                <ListingBuyerActivityCountBadge className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground" />
              </Link>
            </Button>
          ) : null}
          {viewerHasAgencyWorkspace ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className={cn(
                "hidden lg:inline-flex",
                isAgencyActive && "bg-primary/10 text-primary",
              )}
              aria-label="Agency HQ"
            >
              <Link
                href="/controlroom"
                aria-current={isAgencyActive ? "page" : undefined}
                title="Agency HQ"
              >
                <TowerControl className="size-5" />
              </Link>
            </Button>
          ) : null}
          {isAdmin ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className={cn(
                "hidden lg:inline-flex",
                isAdminActive && "bg-primary/10 text-primary",
              )}
              aria-label="Admin"
            >
              <Link
                href="/admin"
                aria-current={isAdminActive ? "page" : undefined}
                title="Admin"
              >
                <ShieldCheck className="size-5" />
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className={cn(
              "size-8 lg:hidden",
              isMessagesActive && "bg-primary/10 text-primary",
            )}
            aria-label="Messages"
          >
            <Link
              href={messagesHref}
              aria-current={isMessagesActive ? "page" : undefined}
              className="relative"
              title="Messages"
            >
              <Send className="size-4" />
              {viewerUsername ? (
                <MessageCountBadge className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-black leading-3.5 text-primary-foreground" />
              ) : null}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="size-8 lg:hidden"
            aria-label="Events"
          >
            <Link
              href={eventsHref}
              aria-current={isEventsActive ? "page" : undefined}
              className={cn(
                "relative",
                isEventsActive && "bg-primary/10 text-primary",
              )}
              title="Events"
            >
              <Heart className="size-4" />
              {viewerUsername ? (
                <EventCountBadge className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-black leading-3.5 text-primary-foreground" />
              ) : null}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className={cn(
              "hidden lg:inline-flex",
              isMessagesActive && "bg-primary/10 text-primary",
            )}
            aria-label="Messages"
          >
            <Link
              href={messagesHref}
              aria-current={isMessagesActive ? "page" : undefined}
              className="relative"
            >
              <Send className="size-5" />
              {viewerUsername ? (
                <MessageCountBadge className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground" />
              ) : null}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden lg:inline-flex"
            aria-label="Events"
          >
            <Link
              href={eventsHref}
              aria-current={isEventsActive ? "page" : undefined}
              className={cn(
                "relative",
                isEventsActive && "bg-primary/10 text-primary",
              )}
            >
              <Heart className="size-5" />
              {viewerUsername ? (
                <EventCountBadge className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground" />
              ) : null}
            </Link>
          </Button>
          {viewerUsername ? (
            <Button
              asChild
              className={cn(
                "hidden px-6 sm:inline-flex",
                isProfileActive && "ring-2 ring-primary/35 ring-offset-2",
              )}
            >
              <Link
                href={`/users/${viewerUsername}`}
                aria-current={isProfileActive ? "page" : undefined}
                prefetch={isProfileActive ? false : undefined}
              >
                Profile
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className={cn(
                "hidden px-6 sm:inline-flex",
                isProfileActive && "ring-2 ring-primary/35 ring-offset-2",
              )}
            >
              <Link
                href="/sign-in"
                aria-current={isProfileActive ? "page" : undefined}
              >
                Sign in
              </Link>
            </Button>
          )}
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-6" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px] lg:hidden" />
              <Dialog.Content className="fixed bottom-0 right-0 top-0 z-[90] flex w-[min(82vw,22rem)] flex-col border-l border-border bg-background text-foreground shadow-2xl outline-none lg:hidden">
                <div className="flex h-20 items-center justify-between border-b border-border/70 px-5">
                  <Dialog.Title className="text-base font-bold">Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X className="size-5" />
                    </Button>
                  </Dialog.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                  <nav className="flex flex-col gap-1">
                    <GlobalUserSearchTrigger
                      display="menu-item"
                      onOpen={() => setMenuOpen(false)}
                    />
                    <InstallHomzieButton
                      className="mb-2 h-12 justify-start rounded-md px-3 shadow-none"
                    />
                    {mobileItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = isActiveHref(item.href);

                      return (
                        <Dialog.Close key={item.label} asChild>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            prefetch={isActive ? false : undefined}
                            className={cn(
                              "flex min-h-12 items-center justify-between rounded-md px-3 text-base font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                              isActive &&
                                "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary focus:bg-primary/15 focus:text-primary",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <Icon className="size-5 shrink-0 text-current" />
                              <span>{item.label}</span>
                            </span>
                            {item.label === "Events" && viewerUsername ? (
                              <EventCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-black leading-5 text-primary-foreground" />
                            ) : null}
                            {item.label === "Listing buyers" && viewerUsername ? (
                              <ListingBuyerActivityCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-black leading-5 text-primary-foreground" />
                            ) : null}
                            {item.label === "Messages" && viewerUsername ? (
                              <MessageCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-black leading-5 text-primary-foreground" />
                            ) : null}
                          </Link>
                        </Dialog.Close>
                      );
                    })}
                  </nav>
                </div>

                <div className="shrink-0 bg-background">
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 px-5 py-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Theme
                    </span>
                    <ThemeToggle />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 px-5 py-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Country
                    </span>
                    <CountryPreferenceSelector />
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 px-5 py-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Currency
                    </span>
                    <CurrencySelector />
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
      </header>
    </>
  );
}
