"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  Clapperboard,
  CircleHelp,
  Heart,
  Home,
  Menu,
  MoreHorizontal,
  Radar,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
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
import { toPublicMediaUrl } from "@/media/paths";
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
  { href: "/listings", icon: Building2, label: "Listings" },
  { href: "/agents", icon: UsersRound, label: "Agents" },
  { href: "/reels", icon: Clapperboard, label: "Reels" },
  { href: "/about", icon: CircleHelp, label: "About" },
  { href: "/contact", icon: Send, label: "Contact" },
];
const primaryNavItems = navItems.slice(0, 3);
const secondaryNavItems = navItems.slice(3);

export function GlobalHeader({
  transparentUntilScroll = false,
  viewerAvatarUrl,
  viewerHasAgencyWorkspace = false,
  viewerName,
  viewerRole,
  viewerUsername,
}: {
  transparentUntilScroll?: boolean;
  viewerAvatarUrl?: string | null;
  viewerHasAgencyWorkspace?: boolean;
  viewerName?: string;
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
  const safeViewerAvatarUrl = toPublicMediaUrl(viewerAvatarUrl);
  const viewerInitials = getInitials(viewerName || viewerUsername);
  const profileHref = viewerUsername ? `/users/${viewerUsername}` : "/sign-in";
  const listFreeHref = viewerUsername
    ? "/listings/new"
    : "/sign-up?callbackUrl=/listings/new";
  const messagesHref = "/messages";
  const eventsHref = viewerUsername ? "/events" : "/sign-in";
  const isProfileActive = isActiveHref(profileHref);
  const isListFreeActive = isActiveHref("/listings/new");
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
      label: "List free",
      href: listFreeHref,
      icon: Sparkles,
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

        <nav className="hidden items-center gap-7 text-sm font-semibold text-foreground lg:flex xl:gap-9">
          {primaryNavItems.map((item) => {
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
                <Icon className="size-4 text-current" />
                {item.label}
                {isActive ? (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "relative flex items-center gap-1.5 py-2 transition-colors hover:text-primary",
                  secondaryNavItems.some((item) => isActiveHref(item.href)) &&
                    "text-primary",
                )}
              >
                <MoreHorizontal className="size-4" />
                More
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={10}
                className="z-[80] min-w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none"
              >
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveHref(item.href);

                  return (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          isActive && "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 lg:gap-3">
          <div className="hidden sm:block lg:hidden">
            <ThemeToggle />
          </div>
          <CountryPreferenceSelector compact className="shrink-0 lg:hidden" />
          <CurrencySelector compact className="shrink-0 lg:hidden" />
          <GlobalUserSearchTrigger className="hidden lg:inline-flex" />
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                aria-label="Preferences"
                title="Preferences"
              >
                <Settings2 className="size-5" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={10}
                className="z-[80] w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl outline-none"
              >
                <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Country
                  </span>
                  <CountryPreferenceSelector compact />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Currency
                  </span>
                  <CurrencySelector compact />
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "relative hidden lg:inline-flex",
                  (isEventsActive ||
                    isActiveHref("/listings/activity") ||
                    isAgencyActive ||
                    isAdminActive) &&
                    "bg-primary/10 text-primary",
                )}
                aria-label="Activity"
                title="Activity"
              >
                <Bell className="size-5" />
                {viewerUsername ? (
                  <EventCountBadge className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground" />
                ) : null}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={10}
                className="z-[80] min-w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none"
              >
                {[
                  { href: eventsHref, icon: Heart, label: "Events", active: isEventsActive },
                  ...(viewerUsername
                    ? [
                        {
                          href: "/listings/activity",
                          icon: Radar,
                          label: "Listing buyers",
                          active: isActiveHref("/listings/activity"),
                        },
                      ]
                    : []),
                  ...(viewerHasAgencyWorkspace
                    ? [
                        {
                          href: "/controlroom",
                          icon: TowerControl,
                          label: "Agency HQ",
                          active: isAgencyActive,
                        },
                      ]
                    : []),
                  ...(isAdmin
                    ? [
                        {
                          href: "/admin",
                          icon: ShieldCheck,
                          label: "Admin",
                          active: isAdminActive,
                        },
                      ]
                    : []),
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <DropdownMenu.Item key={item.label} asChild>
                      <Link
                        href={item.href}
                        aria-current={item.active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-sm font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          item.active && "bg-primary/10 text-primary",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        {item.label === "Events" && viewerUsername ? (
                          <EventCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground" />
                        ) : null}
                        {item.label === "Listing buyers" && viewerUsername ? (
                          <ListingBuyerActivityCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground" />
                        ) : null}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
                <MessageCountBadge className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-3.5 text-primary-foreground" />
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
                <EventCountBadge className="absolute -right-1 -top-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-3.5 text-primary-foreground" />
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
              title="Messages"
            >
              <Send className="size-5" />
              {viewerUsername ? (
                <MessageCountBadge className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground" />
              ) : null}
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className={cn(
              "hidden px-3 sm:inline-flex xl:px-4",
              isListFreeActive && "bg-primary/10 text-primary",
            )}
          >
            <Link
              href={listFreeHref}
              aria-current={isListFreeActive ? "page" : undefined}
              prefetch={isListFreeActive ? false : undefined}
            >
              <Sparkles className="size-4" />
              <span className="hidden xl:inline">List free</span>
            </Link>
          </Button>
          {viewerUsername ? (
            <Link
              href={`/users/${viewerUsername}`}
              aria-current={isProfileActive ? "page" : undefined}
              prefetch={isProfileActive ? false : undefined}
              title="Profile"
              className={cn(
                "relative hidden size-11 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-[2px] shadow-[0_12px_26px_rgba(123,92,255,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(255,77,184,0.26)] sm:flex",
                isProfileActive && "ring-2 ring-primary/35 ring-offset-2",
              )}
            >
              <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-background bg-brand-midnight text-sm font-bold text-white">
                {safeViewerAvatarUrl ? (
                  <Image
                    src={safeViewerAvatarUrl}
                    alt={viewerName || "Profile"}
                    width={40}
                    height={40}
                    className="size-full object-cover"
                  />
                ) : (
                  viewerInitials || <UserRound className="size-4" />
                )}
              </span>
            </Link>
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
                              <EventCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground" />
                            ) : null}
                            {item.label === "Listing buyers" && viewerUsername ? (
                              <ListingBuyerActivityCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground" />
                            ) : null}
                            {item.label === "Messages" && viewerUsername ? (
                              <MessageCountBadge className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground" />
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

function getInitials(value: string | null | undefined) {
  if (!value) return "";

  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
