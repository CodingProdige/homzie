"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BadgeCheck,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Eye,
  Flag,
  Heart,
  Home,
  LockKeyhole,
  Mail,
  Menu,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  UsersRound,
  UserRound,
  UserPlus,
  MessageCircle,
  Play,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toPublicMediaUrl } from "@/media/paths";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";

type UserProfile = {
  name: string;
  username: string;
  avatarUrl?: string;
  isOwner: boolean;
  hasActiveSubscription: boolean;
  reels: ProfileReel[];
  viewerUsername?: string;
  viewerAvatarUrl?: string;
};

type ProfileTab = "reels" | "listings" | "saved";
type ProfileReelStatus = "draft" | "failed" | "processing" | "published";

type ProfileReel = {
  caption?: string | null;
  coverUrl?: string | null;
  durationLabel: string;
  editHref: string;
  id: string;
  status: ProfileReelStatus;
  viewCountLabel: string;
};

const navItems = ["Buy", "Rent", "Developments", "Commercial", "Agents", "Reels"];

const agentCtaFeatures = [
  {
    icon: Home,
    title: "Create listings",
    description: "Showcase properties that get attention.",
    className: "bg-primary/10 text-primary",
  },
  {
    icon: Clapperboard,
    title: "Post reels",
    description: "Share videos that build trust and reach.",
    className: "bg-brand-pink/10 text-brand-pink",
  },
  {
    icon: UsersRound,
    title: "Grow followers",
    description: "Build your audience and your brand.",
    className: "bg-orange-100 text-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Capture leads",
    description: "Get enquiries from serious buyers.",
    className: "bg-emerald-100 text-emerald-600",
  },
];

function BrandHeader({ viewerUsername }: { viewerUsername?: string }) {
  const mobileItems = [
    ...navItems.map((item) => ({
      label: item,
      href: item === "Agents" ? "/agents" : item === "Reels" ? "/reels" : "#",
    })),
    {
      label: viewerUsername ? "Profile" : "Sign in",
      href: viewerUsername ? `/users/${viewerUsername}` : "/sign-in",
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="grid h-20 w-full grid-cols-[1fr_auto_1fr] items-center px-3 lg:flex lg:justify-between">
        <div className="flex justify-start lg:hidden">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="size-5" />
          </Button>
        </div>

        <Link
          href="/"
          className="flex items-center justify-center gap-3 lg:justify-start"
          aria-label="Homzie home"
        >
          <Image
            src="/logo/homzie-logo-dark-tight.png"
            alt="Homzie"
            width={1099}
            height={310}
            className="h-8 w-auto object-contain sm:h-9 lg:h-11"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-10 text-sm font-semibold text-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item}
              href={
                item === "Agents" ? "/agents" : item === "Reels" ? "/reels" : "#"
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

        <div className="flex items-center justify-end gap-2 lg:gap-3">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label="Messages"
          >
            <Send className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Saved properties">
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
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden" />
              <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(82vw,22rem)] flex-col border-l border-border bg-background text-foreground shadow-2xl outline-none lg:hidden">
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
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const safeAvatarUrl = toPublicMediaUrl(avatarUrl);

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-1 sm:size-36 lg:size-40">
      {safeAvatarUrl ? (
        <Image
          src={safeAvatarUrl}
          alt={name}
          width={160}
          height={160}
          className="size-full rounded-full border-4 border-background object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full border-4 border-background bg-brand-midnight text-3xl font-bold text-white sm:text-5xl">
          {initialsFromName(name) || "H"}
        </div>
      )}
    </div>
  );
}

function CreateNewMenu({
  hasActiveSubscription,
}: {
  hasActiveSubscription: boolean;
}) {
  const createItems = getCreateItems(hasActiveSubscription);

  return (
    <>
      <div className="hidden sm:block">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button className="min-w-0 px-4">
              Create New
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
            >
              {createItems.map((item) => {
                const Icon = item.icon;

                return (
                  <DropdownMenu.Item key={item.label} asChild>
                    <Link
                      href={item.href}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      {hasActiveSubscription ? (
                        <Icon className="size-4 text-primary" />
                      ) : (
                        <LockKeyhole className="size-4 text-primary" />
                      )}
                      New {item.label}
                    </Link>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button className="min-w-0 px-4 sm:hidden">
            Create New
            <ChevronDown className="size-4" />
          </Button>
        </Dialog.Trigger>
        <CreateNewDialogContent hasActiveSubscription={hasActiveSubscription} />
      </Dialog.Root>
    </>
  );
}

function getCreateItems(hasActiveSubscription: boolean) {
  return [
    {
      label: "Reel",
      description: "Post a vertical property video.",
      href: hasActiveSubscription ? "/reels/new" : "/become-agent",
      icon: Clapperboard,
    },
    {
      label: "Listing",
      description: "Create a property listing.",
      href: hasActiveSubscription ? "#" : "/become-agent",
      icon: Home,
    },
  ];
}

function CreateNewDialogContent({
  hasActiveSubscription,
}: {
  hasActiveSubscription: boolean;
}) {
  const createItems = getCreateItems(hasActiveSubscription);

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm sm:hidden" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-lg font-bold">Create New</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Choose what you want to publish.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full border bg-background"
              aria-label="Close create menu"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>
        </div>

        <div className="mt-5 space-y-1">
          {createItems.map((item) => {
            const Icon = item.icon;

            return (
              <Dialog.Close key={item.label} asChild>
                <Link
                  href={item.href}
                  className="flex min-w-0 items-center gap-4 rounded-md px-2 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {hasActiveSubscription ? (
                    <Icon className="size-6 shrink-0 text-muted-foreground" />
                  ) : (
                    <LockKeyhole className="size-6 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold">New {item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {hasActiveSubscription
                        ? item.description
                        : "Unlock agent tools to publish."}
                    </span>
                  </span>
                </Link>
              </Dialog.Close>
            );
          })}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function ShareProfileDialog({
  username,
  name,
  iconOnly = false,
  className,
}: {
  username: string;
  name: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const profilePath = `/users/${username}`;
  const shareText = `Check out ${name}'s Homzie profile`;
  const shareTargets = [
    {
      label: "WhatsApp",
      getHref: (url: string) =>
        `https://wa.me/?text=${encodeURIComponent(`${shareText}: ${url}`)}`,
      icon: MessageCircle,
    },
    {
      label: "X",
      getHref: (url: string) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      icon: X,
    },
    {
      label: "Facebook",
      getHref: (url: string) =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      iconText: "f",
    },
    {
      label: "Email",
      getHref: (url: string) =>
        `mailto:?subject=${encodeURIComponent(`${name} on Homzie`)}&body=${encodeURIComponent(`${shareText}: ${url}`)}`,
      icon: Mail,
    },
  ];

  function getProfileUrl() {
    return `${window.location.origin}${profilePath}`;
  }

  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(getProfileUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareProfile() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${name} on Homzie`,
          text: shareText,
          url: getProfileUrl(),
        });
        return;
      }

      await copyProfileLink();
    } catch {
      // Native share can reject when a user cancels the sheet.
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon" aria-label="Share profile">
            <Share2 className="size-5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className={className}
            aria-label="Share profile"
          >
            <Share2 className="size-4" />
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-background p-5 shadow-2xl outline-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,26rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold">Share Profile</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Send @{username} to someone.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-full border bg-background"
                aria-label="Close share profile"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-lg border bg-card p-3">
            <p className="truncate text-sm font-medium">{profilePath}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-lg border bg-background text-sm font-semibold transition-colors hover:bg-accent"
              onClick={copyProfileLink}
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy Link"}
            </button>
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95"
              onClick={shareProfile}
            >
              <Share2 className="size-4" />
              Share
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-3">
            {shareTargets.map((target) => {
              const Icon = target.icon;

              return (
                <button
                  key={target.label}
                  type="button"
                  className="flex min-w-0 flex-col items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors hover:bg-accent"
                  onClick={() => {
                    const href = target.getHref(getProfileUrl());

                    if (href.startsWith("mailto:")) {
                      window.location.href = href;
                      return;
                    }

                    window.open(href, "_blank", "noopener,noreferrer");
                  }}
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-foreground">
                    {Icon ? (
                      <Icon className="size-5" />
                    ) : (
                      <span className="font-serif text-xl font-bold leading-none">
                        {target.iconText}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{target.label}</span>
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProfileHero({ profile }: { profile: UserProfile }) {
  return (
    <section className="page-container grid grid-cols-[92px_minmax(0,1fr)] items-center gap-x-4 gap-y-5 py-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-5 sm:py-8 lg:grid-cols-[180px_1fr_auto] lg:items-start lg:gap-x-5 lg:gap-y-8 lg:py-16">
      <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} />

      <div className="min-w-0 lg:max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">
            {profile.name}
          </h1>
          {profile.hasActiveSubscription ? (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 ring-2 ring-background sm:size-6"
              title="Verified Homzie agent"
            >
              <BadgeCheck className="size-3.5 sm:size-4" />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground sm:mt-1 sm:text-sm">
          @{profile.username}
        </p>

        <div className="mt-3 grid max-w-sm grid-cols-3 gap-2 sm:mt-5 sm:flex sm:gap-10">
          {[
            { label: "Posts", value: "0" },
            { label: "Followers", value: "0" },
            { label: "Following", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <div className="text-lg font-bold leading-none tracking-tight sm:text-2xl">
                {stat.value}
              </div>
              <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground sm:text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2">
        <div className="mt-7 max-w-full space-y-1 text-sm leading-6">
          <p className="font-bold">Homzie profile</p>
          <p className="max-w-full text-wrap text-muted-foreground">
            Reels, saved homes, listings, and profile details will appear here as this account gets set up.
          </p>
        </div>

        <div className="mt-7 inline-grid max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-3 sm:grid-cols-[14rem_auto_2.25rem]">
          {profile.isOwner ? (
            <>
              <Button asChild variant="outline" className="min-w-0">
                <Link href="/settings">Profile Settings</Link>
              </Button>
              <CreateNewMenu hasActiveSubscription={profile.hasActiveSubscription} />
              <ShareProfileDialog
                username={profile.username}
                name={profile.name}
              />
            </>
          ) : (
            <>
              <Button>Follow</Button>
              <Button variant="outline">Message</Button>
              <Button variant="outline" size="icon" aria-label="Add profile">
                <UserPlus className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:block" />
    </section>
  );
}

function AgentBrandCta() {
  return (
    <section className="page-container pb-8">
      <div className="relative isolate overflow-hidden rounded-lg border border-primary/10 bg-[#f5f0ff] p-6 shadow-sm md:p-8 lg:grid lg:min-h-[360px] lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_95%_5%,rgba(255,77,184,0.24),transparent_34%),radial-gradient(circle_at_6%_100%,rgba(78,42,255,0.12),transparent_35%)]" />

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Build your property brand
          </p>
          <h2 className="mt-4 max-w-xl text-[1.75rem] font-bold leading-[1.12] tracking-tight text-brand-black sm:text-4xl">
            Turn your profile into a{" "}
            <span className="homzie-gradient-text">
              property creator
            </span>{" "}
            portfolio.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Unlock the tools to showcase properties, grow your audience, and capture real leads.
          </p>

          <div className="mt-8 hidden grid-cols-4 gap-8 md:grid">
            {agentCtaFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title}>
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-lg shadow-sm",
                      feature.className,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-4 text-xs font-bold text-brand-black">{feature.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#6f6f7d]">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 min-w-0 px-7">
              <Link href="/become-agent">
                <Sparkles className="size-4" />
                Start Building My Brand
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative hidden min-h-[300px] lg:block">
          <div className="absolute left-0 top-24 z-20 rounded-lg bg-white px-4 py-3 text-xs font-bold text-brand-black shadow-xl">
            <span className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />
              Build your personal brand
            </span>
          </div>
          <div className="absolute right-0 top-5 z-20 rounded-lg bg-white px-4 py-3 text-xs font-bold text-brand-black shadow-xl">
            <span className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              More visibility
            </span>
            <span className="mt-1 block text-muted-foreground">More leads</span>
          </div>
          <div className="absolute right-0 bottom-12 z-20 rounded-lg bg-white px-4 py-3 text-xs font-bold text-brand-black shadow-xl">
            <span className="flex items-center gap-2">
              <Eye className="size-4 text-emerald-600" />
              Grow your business
            </span>
          </div>
          <div className="absolute right-16 top-9 w-[260px] overflow-hidden rounded-lg bg-white text-brand-black shadow-2xl">
            <div className="relative h-[190px] bg-[linear-gradient(135deg,#2a3657,#8da0ca)]">
              <div className="absolute inset-x-6 bottom-7 rounded-md bg-brand-black/90 p-4">
                <div className="h-16 rounded bg-[linear-gradient(135deg,#f29b38,#7b5cff)]" />
              </div>
              <div className="absolute left-10 top-8 h-16 w-28 rounded-t-lg bg-[#243151]" />
              <div className="absolute bottom-7 left-10 h-14 w-36 rounded-t-lg bg-[#1d2845]" />
              <div className="absolute bottom-7 right-10 h-20 w-16 rounded-t-lg bg-[#2b3758]" />
              <div className="absolute bottom-7 left-14 h-6 w-20 rounded bg-[#f1a14a]/80" />
              <div className="absolute bottom-7 right-20 h-8 w-20 rounded bg-[#7b5cff]/80" />
              <div className="absolute inset-x-0 bottom-0 h-7 bg-[#6e84aa]" />
              <div className="absolute left-6 top-5 rounded-full bg-white/90 p-1.5 text-primary shadow">
                <Flag className="size-4" />
              </div>
            </div>
            <div className="p-4">
              <span className="rounded-sm bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">
                For Sale
              </span>
              <p className="mt-2 text-lg font-bold">R3,850,000</p>
              <p className="mt-1 text-xs text-muted-foreground">
                3 Bed · 2 Bath · 180m2
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">Bloubergstrand, Cape Town</span>
                <Bookmark className="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileTabs({
  activeTab,
  isLocked,
  onTabChange,
}: {
  activeTab: ProfileTab;
  isLocked: boolean;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const tabs = [
    { id: "reels", label: "Reels", icon: Clapperboard },
    { id: "listings", label: "Listings", icon: Home },
    { id: "saved", label: "Saved", icon: Bookmark },
  ];

  return (
    <div className="border-y border-border">
      <div className="page-container grid grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.label}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:gap-2 sm:text-sm",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              type="button"
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id as ProfileTab)}
            >
              <span className="relative leading-none">
                <Icon className="size-4" />
                {isLocked && (tab.id === "reels" || tab.id === "listings") ? (
                  <LockKeyhole className="absolute -right-2 -top-1.5 size-2.5 text-destructive" />
                ) : null}
              </span>
              <span className="max-w-full truncate leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-lg border-dashed p-8 text-center shadow-none">
      <p className="font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </Card>
  );
}

function ProfileTabPanel({
  activeTab,
  reels,
  username,
}: {
  activeTab: ProfileTab;
  reels: ProfileReel[];
  username: string;
}) {
  const [watchedReelIds, setWatchedReelIds] = useState<Set<string>>(
    () => new Set(),
  );
  const emptyStates: Record<ProfileTab, { title: string; description: string }> = {
    reels: {
      title: "No reels yet",
      description: "When this profile posts property videos, they will appear here.",
    },
    listings: {
      title: "No listings yet",
      description: "Linked properties and active listings will appear here once published.",
    },
    saved: {
      title: "No saved homes yet",
      description: "Saved properties are private until we build the full saved homes experience.",
    },
  };
  const emptyState = emptyStates[activeTab];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readWatchedIds = () => {
      const scopedIds = JSON.parse(
        window.sessionStorage.getItem(`homzie-seen-reels:${username}`) || "[]",
      ) as string[];
      const allIds = JSON.parse(
        window.sessionStorage.getItem("homzie-seen-reels:all") || "[]",
      ) as string[];

      setWatchedReelIds(new Set([...scopedIds, ...allIds]));
    };

    readWatchedIds();
    window.addEventListener("storage", readWatchedIds);

    return () => window.removeEventListener("storage", readWatchedIds);
  }, [username]);

  return (
    <section className="page-container py-8">
      {activeTab === "reels" && reels.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {reels.map((reel) => (
            <ProfileReelCard
              key={reel.id}
              reel={reel}
              username={username}
              watched={watchedReelIds.has(reel.id)}
            />
          ))}
        </div>
      ) : (
        <div>
          <EmptyState title={emptyState.title} description={emptyState.description} />
        </div>
      )}
    </section>
  );
}

function ProfileReelCard({
  reel,
  username,
  watched,
}: {
  reel: ProfileReel;
  username: string;
  watched: boolean;
}) {
  const badgeStyles: Record<ProfileReelStatus, string> = {
    draft: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    processing: "bg-violet-100 text-violet-700",
    published: "bg-emerald-100 text-emerald-700",
  };
  const badgeLabel: Record<ProfileReelStatus, string> = {
    draft: "Draft",
    failed: "Failed",
    processing: "Processing",
    published: "Live",
  };
  const href =
    reel.status === "published" ? `/users/${username}/reels` : reel.editHref;

  return (
    <Link
      href={href}
      className="group relative isolate aspect-[9/16] overflow-hidden rounded-md bg-brand-midnight text-white shadow-sm"
    >
      {reel.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cover thumbnails are stored canvas data URLs or local media paths.
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          src={reel.coverUrl}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,0.38),transparent_34%),linear-gradient(155deg,#111116,#050508)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/70" />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
        {watched && reel.status === "published" ? (
          <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm backdrop-blur">
            Watched
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[10px] font-black uppercase",
            badgeStyles[reel.status],
          )}
        >
          {badgeLabel[reel.status]}
        </span>
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <div className="flex items-center gap-1.5 text-xs font-black">
          <Play className="size-3.5 fill-current" />
          {reel.viewCountLabel} views
          <span className="text-white/45">·</span>
          {reel.durationLabel}
        </div>
        {reel.caption ? (
          <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-white/85">
            {reel.caption}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function MobileBottomNav({
  hasActiveSubscription,
  viewerUsername,
  viewerAvatarUrl,
}: {
  hasActiveSubscription: boolean;
  viewerUsername?: string;
  viewerAvatarUrl?: string;
}) {
  const items = [
    { label: "Home", icon: Home, href: "/", active: true },
    { label: "Messages", icon: Send, href: "#" },
    {
      label: hasActiveSubscription ? "Create" : "Agent",
      icon: Plus,
      href: "#",
      primary: true,
    },
    { label: "Reels", icon: Clapperboard, href: "/reels" },
    {
      label: "Profile",
      icon: UserRound,
      href: viewerUsername ? `/users/${viewerUsername}` : "/sign-in",
    },
  ];
  const safeViewerAvatarUrl = toPublicMediaUrl(viewerAvatarUrl);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto grid h-[64px] w-full max-w-[calc(100vw-24px)] grid-cols-5 items-center rounded-full border border-white/10 bg-brand-black px-3 py-2 shadow-2xl shadow-black/35 sm:max-w-[640px]">
        {items.map((item) => {
          const Icon = item.icon;
          const navItemClassName = cn(
            "flex h-full min-w-0 items-center justify-center rounded-md px-1 text-white/55 transition-colors hover:text-white",
            item.active && "text-white",
            item.primary && "text-white",
          );
          const iconWrapClassName = cn(
            "flex size-10 items-center justify-center",
            item.primary &&
              "size-11 rounded-full bg-[var(--homzie-gradient)] shadow-[0_0_0_7px_rgba(123,92,255,0.12),0_0_26px_rgba(123,92,255,0.72),0_0_48px_rgba(255,77,184,0.36)]",
            item.label === "Profile" &&
              safeViewerAvatarUrl &&
              "overflow-hidden rounded-full border border-white/20 bg-white",
          );

          if (item.primary) {
            return (
              <Dialog.Root key={item.label}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className={navItemClassName}
                    aria-label={
                      hasActiveSubscription
                        ? "Create new"
                        : "Become an agent to create"
                    }
                  >
                    <span className={iconWrapClassName}>
                      <Icon className="size-5" />
                    </span>
                  </button>
                </Dialog.Trigger>
                <CreateNewDialogContent
                  hasActiveSubscription={hasActiveSubscription}
                />
              </Dialog.Root>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={navItemClassName}
              aria-label={item.label}
            >
              <span className={iconWrapClassName}>
                {item.label === "Profile" && safeViewerAvatarUrl ? (
                  <Image
                    src={safeViewerAvatarUrl}
                    alt="Profile"
                    width={36}
                    height={36}
                    className="size-full object-cover"
                  />
                ) : (
                  <Icon className="size-5" />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AgentPaymentStatusDialog({
  hasActiveSubscription,
}: {
  hasActiveSubscription: boolean;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined" || !hasActiveSubscription) {
      return false;
    }

    return Boolean(window.sessionStorage.getItem("homzie-agent-payment-success"));
  });

  useEffect(() => {
    if (open) {
      window.sessionStorage.removeItem("homzie-agent-payment-success");
    }
  }, [open]);

  if (!hasActiveSubscription) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 text-center text-foreground shadow-2xl outline-none">
          <div
            className={cn(
              "mx-auto flex size-14 items-center justify-center rounded-full",
              "bg-emerald-100 text-emerald-600",
            )}
          >
            <Check className="size-7 stroke-[3]" />
          </div>
          <Dialog.Title className="mt-5 text-2xl font-bold">
            Payment successful
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            Your Homzie Agent subscription is active. Agent tools are now unlocked
            on your profile.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button className="mt-6 w-full">
              Open my profile
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function UserProfilePage({
  profile,
}: {
  profile: UserProfile;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("reels");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandHeader viewerUsername={profile.viewerUsername} />
      <main className="page-body pb-24">
        <ProfileHero profile={profile} />
        {profile.isOwner && !profile.hasActiveSubscription ? <AgentBrandCta /> : null}
        <ProfileTabs
          activeTab={activeTab}
          isLocked={profile.isOwner && !profile.hasActiveSubscription}
          onTabChange={setActiveTab}
        />
        <ProfileTabPanel
          activeTab={activeTab}
          reels={profile.reels}
          username={profile.username}
        />
      </main>
      <MobileBottomNav
        hasActiveSubscription={profile.hasActiveSubscription}
        viewerUsername={profile.viewerUsername}
        viewerAvatarUrl={profile.viewerAvatarUrl}
      />
      <AgentPaymentStatusDialog
        hasActiveSubscription={profile.hasActiveSubscription}
      />
    </div>
  );
}
