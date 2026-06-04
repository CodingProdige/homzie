"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Heart, Menu, Send, X } from "lucide-react";

import { CountryPreferenceSelector } from "@/components/country-preference-selector";
import { GlobalUserSearchTrigger } from "@/components/global-user-search";
import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";
import { CurrencySelector } from "@/modules/currency/currency-selector";

const navItems = ["Agents", "Reels", "Listings"];

export function GlobalHeader({
  transparentUntilScroll = false,
  viewerUsername,
}: {
  transparentUntilScroll?: boolean;
  viewerUsername?: string;
}) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrolled = !transparentUntilScroll || hasScrolled;
  const mobileItems = [
    ...navItems.map((item) => ({
      label: item,
      href:
        item === "Agents"
          ? "/agents"
          : item === "Reels"
            ? "/reels"
            : "/listings",
    })),
    {
      label: viewerUsername ? "Profile" : "Sign in",
      href: viewerUsername ? `/users/${viewerUsername}` : "/sign-in",
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
          {navItems.map((item) => (
            <Link
              key={item}
              href={
                item === "Agents"
                  ? "/agents"
                  : item === "Reels"
                    ? "/reels"
                    : "/listings"
              }
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              {item}
              {item === "Reels" ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                  New
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 lg:gap-3">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <CountryPreferenceSelector compact className="shrink-0" />
          <CurrencySelector compact className="shrink-0" />
          <GlobalUserSearchTrigger className="hidden lg:inline-flex" />
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label="Messages"
          >
            <Send className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label="Saved properties"
          >
            <Heart className="size-5" />
          </Button>
          {viewerUsername ? (
            <Button asChild className="hidden px-6 sm:inline-flex">
              <Link href={`/users/${viewerUsername}`}>Profile</Link>
            </Button>
          ) : (
            <Button asChild className="hidden px-6 sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
          <Dialog.Root>
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

                <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
                  {mobileItems.map((item) => (
                    <Dialog.Close key={item.label} asChild>
                      <Link
                        href={item.href}
                        className="flex min-h-12 items-center justify-between rounded-md px-3 text-base font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        {item.label}
                        {item.label === "Reels" ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                            New
                          </span>
                        ) : null}
                      </Link>
                    </Dialog.Close>
                  ))}
                </nav>

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
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
