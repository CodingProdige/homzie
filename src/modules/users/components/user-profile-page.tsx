"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BadgeCheck,
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Copy,
  CircleDollarSign,
  Eye,
  Flag,
  Home,
  LockKeyhole,
  Mail,
  PieChart,
  Plus,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  UsersRound,
  UserRound,
  MessageCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlobalHeader } from "@/components/global-header";
import { GlobalFooter } from "@/components/global-footer";
import { cn } from "@/lib/utils";
import { toPublicMediaUrl } from "@/media/paths";
import { useCurrency } from "@/modules/currency/currency-provider";
import { AgencyBrandBadge } from "@/modules/agencies/components/agency-brand-badge";
import type { EffectiveAgencyBrand } from "@/modules/agencies/server";
import { ListingCard, type ListingCardData } from "@/modules/listings/components/listing-card";
import { startConversationAction } from "@/modules/messages/actions";
import { ReportContentButton } from "@/modules/moderation/report-content-button";
import { toggleProfileFollow } from "@/modules/reels/actions";
import { ReelPreviewCard } from "@/modules/reels/components/reel-preview-card";

type UserProfile = {
  agencyBrand?: EffectiveAgencyBrand;
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  connections: {
    followers: ProfileConnection[];
    following: ProfileConnection[];
  };
  agentStats: AgentPerformanceStats;
  archiveFeedback?: string;
  isOwner: boolean;
  isFollowing?: boolean;
  hasActiveSubscription: boolean;
  initialTab?: ProfileTab;
  listings: ProfileListing[];
  reels: ProfileReel[];
  savedListings: ProfileListing[];
  savedReels: ProfileReel[];
  viewerHasAgencyWorkspace?: boolean;
  viewerRole?: "user" | "admin";
  viewerSignedIn?: boolean;
  viewerUsername?: string;
  viewerAvatarUrl?: string;
};

type ProfileTab = "reels" | "listings" | "saved";
type ConnectionTab = "followers" | "following";
type ProfileReelStatus = "draft" | "failed" | "processing" | "published";

type ProfileConnection = {
  avatarUrl?: string;
  bio?: string;
  id: string;
  isFollowingByViewer: boolean;
  isViewer: boolean;
  name: string;
  username: string;
};

type AgentPerformanceStats = {
  avgDaysToSellLabel: string;
  completedMandates: number;
  completedMandatesLabel: string;
  disputedCount: number;
  expiredCount: number;
  soldCount: number;
  soldExternallyCount: number;
  soldThisYear: number;
  soldThisYearLabel: string;
  totalSoldValueThisYearCents: number;
  totalSoldValueThisYearLabel: string;
  verifiedSales: number;
  verifiedSalesLabel: string;
  withdrawnCount: number;
  winRateLabel: string;
};

type ProfileReel = {
  caption?: string | null;
  coverUrl?: string | null;
  durationLabel: string;
  editHref: string;
  id: string;
  renderProgress?: number | null;
  status: ProfileReelStatus;
  viewCountLabel: string;
};

type ProfileListing = {
  askingPriceCents: number | null;
  bathrooms: number;
  bedrooms: number;
  buyerIncentive: string;
  coverImageUrl?: string | null;
  erfSize: number;
  features: string[];
  floorSize: number;
  garages: number;
  href?: string;
  id: string;
  imageUrls: string[];
  likedByViewer?: boolean;
  likeCount: number;
  likeCountLabel: string;
  listingType: string;
  location: string | null;
  mandateEndDate: string;
  mandateStartDate: string;
  mandateType: string;
  parking: number;
  priceLabel: string | null;
  previousAskingPriceCents: number;
  propertyType: string;
  savedByViewer?: boolean;
  saveCount: number;
  saveCountLabel: string;
  status: string;
  title: string;
  unavailable?: boolean;
  unavailableLabel?: string;
  statusLabel?: string;
  videoUrls?: string[];
};

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

function CreateNewMenu() {
  const createItems = getCreateItems();

  return (
    <>
      <div className="hidden sm:block">
        <DropdownMenu.Root modal={false}>
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
                      <Icon className="size-4 text-primary" />
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
        <CreateNewDialogContent />
      </Dialog.Root>
    </>
  );
}

function getCreateItems() {
  return [
    {
      label: "Reel",
      description: "Post a vertical property video.",
      href: "/reels/new",
      icon: Clapperboard,
    },
    {
      label: "Listing",
      description: "Create a property listing.",
      href: "/listings/new",
      icon: Home,
    },
  ];
}

function CreateNewDialogContent() {
  const createItems = getCreateItems();

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
                  <Icon className="size-6 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block font-semibold">New {item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
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
  const [followerCount, setFollowerCount] = useState(() =>
    profileCountNumber(profile.followerCount),
  );
  const [followingCount, setFollowingCount] = useState(() =>
    profileCountNumber(profile.followingCount),
  );
  const [connectionDialogTab, setConnectionDialogTab] =
    useState<ConnectionTab | null>(null);

  return (
    <section className="page-container grid grid-cols-[92px_minmax(0,1fr)] items-start gap-x-4 gap-y-5 py-6 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-5 sm:py-8 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-x-5 lg:py-16">
      <ProfileAvatar name={profile.name} avatarUrl={profile.avatarUrl} />

      <div className="min-w-0 lg:max-w-[calc(100%-9rem)]">
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
        {profile.agencyBrand ? (
          <AgencyBrandBadge brand={profile.agencyBrand} className="mt-2" />
        ) : null}

        <div className="mt-3 grid max-w-sm grid-cols-3 gap-2 sm:mt-5 sm:flex sm:gap-10">
          <div className="min-w-0">
            <div className="text-lg font-bold leading-none tracking-tight sm:text-2xl">
              {formatProfileCount(profile.postCount)}
            </div>
            <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground sm:text-sm">
              Posts
            </div>
          </div>
          {[
            {
              label: "Followers",
              tab: "followers" as const,
              value: formatProfileCount(followerCount),
            },
            {
              label: "Following",
              tab: "following" as const,
              value: formatProfileCount(followingCount),
            },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              className="min-w-0 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setConnectionDialogTab(stat.tab)}
            >
              <div className="text-lg font-bold leading-none tracking-tight sm:text-2xl">
                {stat.value}
              </div>
              <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground sm:text-sm">
                {stat.label}
              </div>
            </button>
          ))}
        </div>
        <ProfileConnectionsDialog
          activeTab={connectionDialogTab || "followers"}
          followers={profile.connections.followers}
          following={profile.connections.following}
          onFollowingCountChange={setFollowingCount}
          open={Boolean(connectionDialogTab)}
          profileIsOwner={profile.isOwner}
          profileName={profile.name}
          onOpenChange={(open) => {
            if (!open) setConnectionDialogTab(null);
          }}
          onTabChange={setConnectionDialogTab}
        />
      </div>

      {profile.bio || profile.location ? (
        <div className="col-span-2 w-full space-y-2 text-sm leading-6 sm:col-span-1 sm:col-start-2 sm:max-w-full lg:max-w-[calc(100%-9rem)]">
          {profile.bio ? (
            <p className="max-w-full whitespace-pre-line text-wrap font-medium text-foreground/80">
              {profile.bio}
            </p>
          ) : null}
          {profile.location ? (
            <p className="max-w-full truncate text-xs font-bold text-muted-foreground sm:text-sm">
              {profile.location}
            </p>
          ) : null}
        </div>
      ) : null}

      {profile.contactEmail || profile.contactPhone || profile.whatsappNumber ? (
        <div className="relative col-span-2 w-full overflow-hidden rounded-lg sm:col-span-1 sm:col-start-2 sm:max-w-full lg:max-w-[calc(100%-9rem)]">
          <div
            className={cn(
              "transition",
              !profile.viewerSignedIn && "pointer-events-none select-none blur-sm",
            )}
            aria-hidden={profile.viewerSignedIn ? undefined : true}
          >
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Contact agent
            </p>
            <div className="mt-1 flex max-w-full flex-col items-start gap-1 text-sm font-bold text-primary">
              {profile.contactEmail ? (
                <a
                  href={`mailto:${profile.contactEmail}`}
                  className="max-w-full break-all hover:underline"
                >
                  {profile.contactEmail}
                </a>
              ) : null}
              {profile.contactPhone ? (
                <a href={`tel:${profile.contactPhone}`} className="hover:underline">
                  {profile.contactPhone}
                </a>
              ) : null}
              {profile.whatsappNumber ? (
                <a
                  href={`https://wa.me/${profile.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  WhatsApp {profile.whatsappNumber}
                </a>
              ) : null}
            </div>
          </div>
          {!profile.viewerSignedIn ? (
            <div className="absolute inset-0 grid place-items-center bg-background/55 p-2 text-center backdrop-blur-[1px]">
              <Button asChild size="sm" className="h-9">
                <Link href={`/register?callbackUrl=${encodeURIComponent(`/users/${profile.username}`)}`}>
                  <LockKeyhole className="size-3.5" />
                  Reveal contact
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="col-span-2 flex max-w-full flex-wrap gap-3 sm:col-span-1 sm:col-start-2">
        {profile.isOwner ? (
          <>
            <Button asChild variant="outline" className="min-w-0 sm:w-56">
              <Link href="/settings">Profile Settings</Link>
            </Button>
            <CreateNewMenu />
            <ShareProfileDialog
              username={profile.username}
              name={profile.name}
            />
            <Button asChild variant="outline" size="icon" className="shrink-0">
              <Link
                href={`/users/${profile.username}/analytics`}
                aria-label="Open content analytics"
                title="Content analytics"
              >
                <BarChart3 className="size-4" />
              </Link>
            </Button>
          </>
        ) : (
          <ProfileVisitorActions
            profile={profile}
            onFollowerCountChange={setFollowerCount}
          />
        )}
      </div>

      <div className="col-span-2 w-full sm:col-span-1 sm:col-start-2 sm:max-w-full lg:-mr-36 xl:-mr-64">
        <AgentPerformanceCard profile={profile} />
      </div>
    </section>
  );
}

function profileCountNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatProfileCount(value: unknown) {
  const safeValue = profileCountNumber(value);

  if (safeValue < 1000) return String(safeValue);

  const compactValue = safeValue / 1000;

  return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}K`;
}

function ConnectionAvatar({ connection }: { connection: ProfileConnection }) {
  const safeAvatarUrl = toPublicMediaUrl(connection.avatarUrl);

  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--homzie-gradient)] p-0.5 text-white">
      {safeAvatarUrl ? (
        <Image
          src={safeAvatarUrl}
          alt={connection.name}
          width={44}
          height={44}
          className="size-full rounded-full border-2 border-background object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center rounded-full border-2 border-background bg-brand-midnight text-xs font-black">
          {initialsFromName(connection.name) || "H"}
        </span>
      )}
    </span>
  );
}

function ProfileConnectionsDialog({
  activeTab,
  followers,
  following,
  onFollowingCountChange,
  onOpenChange,
  onTabChange,
  open,
  profileIsOwner,
  profileName,
}: {
  activeTab: ConnectionTab;
  followers: ProfileConnection[];
  following: ProfileConnection[];
  onFollowingCountChange: (updater: (count: number) => number) => void;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: ConnectionTab) => void;
  open: boolean;
  profileIsOwner: boolean;
  profileName: string;
}) {
  const [followerRows, setFollowerRows] = useState(followers);
  const [followingRows, setFollowingRows] = useState(following);
  const [pendingUsername, setPendingUsername] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const rows = activeTab === "followers" ? followerRows : followingRows;

  function updateFollowState(username: string, isFollowing: boolean) {
    const updateRows = (items: ProfileConnection[]) =>
      items.map((item) =>
        item.username === username
          ? { ...item, isFollowingByViewer: isFollowing }
          : item,
      );

    setFollowerRows(updateRows);
    setFollowingRows(updateRows);
  }

  function removeFollowingRow(username: string) {
    setFollowingRows((items) => items.filter((item) => item.username !== username));
  }

  function handleToggle(connection: ProfileConnection) {
    const previous = connection.isFollowingByViewer;

    setNotice("");
    setPendingUsername(connection.username);
    updateFollowState(connection.username, !previous);

    if (profileIsOwner) {
      onFollowingCountChange((count) =>
        Math.max(0, profileCountNumber(count) + (previous ? -1 : 1)),
      );
    }

    startTransition(async () => {
      const result = await toggleProfileFollow(connection.username);

      setPendingUsername("");

      if (!result.ok) {
        updateFollowState(connection.username, previous);
        if (profileIsOwner) {
          onFollowingCountChange((count) =>
            Math.max(0, profileCountNumber(count) + (previous ? 1 : -1)),
          );
        }
        setNotice(result.error || "Could not update follow status.");
        return;
      }

      updateFollowState(connection.username, result.following);

      if (profileIsOwner && activeTab === "following" && !result.following) {
        removeFollowingRow(connection.username);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] flex max-h-[min(34rem,calc(100dvh-2rem))] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-black">
                {profileName}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                View followers and following.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-2 border-b border-border">
            {[
              { label: "Followers", tab: "followers" as const },
              { label: "Following", tab: "following" as const },
            ].map((item) => (
              <button
                key={item.tab}
                type="button"
                className={cn(
                  "border-b-2 px-4 py-3 text-sm font-black transition-colors",
                  activeTab === item.tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onTabChange(item.tab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {notice ? (
            <p className="border-b border-border px-4 py-2 text-sm font-bold text-destructive">
              {notice}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {rows.length ? (
              rows.map((connection) => (
                <div
                  key={`${activeTab}-${connection.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/70"
                >
                  <Link href={`/users/${connection.username}`} className="shrink-0">
                    <ConnectionAvatar connection={connection} />
                  </Link>
                  <Link
                    href={`/users/${connection.username}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-black">{connection.name}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      @{connection.username}
                    </p>
                    {connection.bio ? (
                      <p className="mt-0.5 line-clamp-1 text-xs font-medium text-muted-foreground">
                        {connection.bio}
                      </p>
                    ) : null}
                  </Link>
                  {connection.isViewer ? (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
                      You
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={connection.isFollowingByViewer ? "outline" : "default"}
                      disabled={isPending && pendingUsername === connection.username}
                      onClick={() => handleToggle(connection)}
                    >
                      {connection.isFollowingByViewer ? "Following" : "Follow"}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="grid min-h-44 place-items-center px-6 text-center">
                <div>
                  <UsersRound className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-black">
                    No {activeTab} yet
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    People will appear here as profiles connect.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProfileVisitorActions({
  onFollowerCountChange,
  profile,
}: {
  onFollowerCountChange: (updater: (count: number) => number) => void;
  profile: UserProfile;
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(Boolean(profile.isFollowing));
  const [notice, setNotice] = useState("");
  const [isFollowPending, startFollowTransition] = useTransition();
  const [isMessagePending, startMessageTransition] = useTransition();

  function handleFollow() {
    const previous = isFollowing;
    setNotice("");
    setIsFollowing(!previous);
    onFollowerCountChange((count) =>
      Math.max(0, profileCountNumber(count) + (previous ? -1 : 1)),
    );

    startFollowTransition(async () => {
      const result = await toggleProfileFollow(profile.username);

      if (!result.ok) {
        setIsFollowing(previous);
        onFollowerCountChange((count) =>
          Math.max(0, profileCountNumber(count) + (previous ? 1 : -1)),
        );
        setNotice(result.error || "Could not update follow status.");
        return;
      }

      setIsFollowing(result.following);
    });
  }

  function handleMessage() {
    setNotice("");

    startMessageTransition(async () => {
      try {
        const result = await startConversationAction({
          recipientUserId: profile.id,
        });

        router.push(`/messages?conversation=${result.conversationId}`);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not open messages right now.",
        );
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
      <Button
        type="button"
        className="min-w-0 flex-1 sm:flex-none sm:w-56"
        disabled={isFollowPending}
        onClick={handleFollow}
        variant={isFollowing ? "outline" : "default"}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
      <Button
        type="button"
        className="min-w-0 flex-1 sm:flex-none sm:w-56"
        disabled={isMessagePending}
        onClick={handleMessage}
        variant="outline"
      >
        {isMessagePending ? "Opening..." : "Message"}
      </Button>
      <ReportContentButton
        compact
        label="Report profile"
        targetId={profile.username}
        targetLabel="profile"
        targetType="profile"
      />
      {notice ? (
        <p className="basis-full text-xs font-bold text-destructive">{notice}</p>
      ) : null}
    </div>
  );
}

function AgentPerformanceCard({ profile }: { profile: UserProfile }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const { formatPriceCentsCompact } = useCurrency();
  const performanceStats = [
    {
      icon: Trophy,
      label: "Win rate",
      value: profile.agentStats.winRateLabel,
    },
    {
      icon: CircleDollarSign,
      label: "Sold this year",
      value: profile.agentStats.soldThisYearLabel,
    },
    {
      icon: PieChart,
      label: "Total value",
      value: formatPriceCentsCompact(profile.agentStats.totalSoldValueThisYearCents),
    },
    {
      icon: Flag,
      label: "Verified sales",
      value: profile.agentStats.verifiedSalesLabel,
    },
  ];

  if (!profile.hasActiveSubscription) {
    return (
      <div className="max-w-lg rounded-lg border border-primary/10 bg-card p-4 shadow-sm lg:max-w-none">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Agent performance
            </p>
            <p className="mt-1 text-sm font-black">Locked until subscribed</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              Verified sales, win rate, and mandate history unlock for Homzie Agent profiles.
            </p>
          </div>
          {profile.isOwner ? (
            <Button asChild size="sm">
              <Link href="/go-pro">Unlock</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-[max-width] duration-300 ease-out lg:max-w-none">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 p-2.5 text-left transition-colors hover:bg-muted/35 sm:hidden"
        onClick={() => setIsMobileDialogOpen(true)}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Trophy className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
            Agent performance
          </p>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
            <p className="text-base font-black leading-none">{profile.agentStats.winRateLabel}</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">
              win rate · {profile.agentStats.soldThisYearLabel} sold this year
            </p>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <button
        type="button"
        className="hidden w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/35 sm:flex"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
      >
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Trophy className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Agent performance
          </p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <p className="text-lg font-black leading-none">{profile.agentStats.winRateLabel}</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">
              win rate · {profile.agentStats.soldThisYearLabel} sold this year
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid border-t border-border transition-[grid-template-rows] duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-3 pb-3 transition-all duration-300 ease-out",
              isExpanded
                ? "translate-y-0 opacity-100"
                : "-translate-y-2 opacity-0",
            )}
          >
            <PerformanceStatsGrid
              avgDaysToSellLabel={profile.agentStats.avgDaysToSellLabel}
              completedMandatesLabel={profile.agentStats.completedMandatesLabel}
              stats={performanceStats}
            />
          </div>
        </div>
      </div>

      <Link
        href={`/users/${profile.username}/performance`}
        className="flex h-11 items-center justify-between border-t border-border px-4 text-sm font-black text-primary transition-colors hover:bg-primary/5"
      >
        See performance breakdown
        <ChevronRight className="size-4" />
      </Link>

      <Dialog.Root open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 z-[91] max-h-[calc(100dvh-2rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-white p-4 text-brand-black shadow-2xl sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-black">
                  Agent performance
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                  {profile.agentStats.winRateLabel} win rate ·{" "}
                  {profile.agentStats.soldThisYearLabel} sold this year
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Close performance">
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="mt-4">
              <PerformanceStatsGrid
                avgDaysToSellLabel={profile.agentStats.avgDaysToSellLabel}
                completedMandatesLabel={profile.agentStats.completedMandatesLabel}
                stats={performanceStats}
              />
            </div>
            <Button asChild className="mt-4 w-full">
              <Link href={`/users/${profile.username}/performance`}>
                See performance breakdown
              </Link>
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function PerformanceStatsGrid({
  avgDaysToSellLabel,
  completedMandatesLabel,
  stats,
}: {
  avgDaysToSellLabel: string;
  completedMandatesLabel: string;
  stats: Array<{
    icon: typeof Trophy;
    label: string;
    value: string;
  }>;
}) {
  return (
    <>
      <div className="grid pt-1 sm:grid-cols-2 sm:gap-x-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="flex min-w-0 items-center gap-3 border-b border-border/60 px-1 py-3 last:border-b-0 sm:border-b-0 lg:flex-col lg:items-start lg:gap-2 lg:border-r lg:border-border/60 lg:px-3 lg:last:border-r-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:size-10">
                <Icon className="size-4 sm:size-5" />
              </span>
              <p className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:text-[11px] lg:flex-none">
                {stat.label}
              </p>
              <p className="min-w-0 truncate text-base font-black sm:text-lg lg:text-2xl">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg bg-primary/5 px-3 py-3 text-xs font-semibold text-muted-foreground lg:mt-2">
        <p>{completedMandatesLabel}</p>
        <p className="mt-1">
          {avgDaysToSellLabel === "No sales yet"
            ? "No sales yet"
            : `${avgDaysToSellLabel} avg days to sell`}
        </p>
      </div>
    </>
  );
}

function AgentBrandCta() {
  const { formatPriceLabel } = useCurrency();

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
            Publish freely, then unlock realtime buyer intent, listing insights, and hotter follow-ups when demand starts moving.
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
              <Link href="/go-pro">
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
              <p className="mt-2 text-lg font-bold">
                {formatPriceLabel("R3,850,000")}
              </p>
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
  canViewSaved,
  listingCount,
  reelCount,
  savedCount,
  isLocked,
  onTabChange,
}: {
  activeTab: ProfileTab;
  canViewSaved: boolean;
  listingCount: number;
  reelCount: number;
  savedCount: number;
  isLocked: boolean;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const tabs = [
    { id: "reels", label: "Reels", icon: Clapperboard, count: reelCount },
    { id: "listings", label: "Listings", icon: Home, count: listingCount },
    ...(canViewSaved
      ? [{ id: "saved", label: "Saved", icon: Bookmark, count: savedCount }]
      : []),
  ];

  return (
    <div className="border-y border-border">
      <div
        className={cn(
          "page-container grid",
          canViewSaved ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showCount = tab.count > 0;
          const showLocked =
            isLocked && (tab.id === "reels" || tab.id === "listings");

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
              <span className="relative grid size-5 place-items-center leading-none">
                <Icon className="size-4" />
                {showCount ? (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-2 grid min-w-4 place-items-center rounded-full border border-background px-1 py-0.5 text-[9px] font-black leading-none shadow-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                ) : null}
                {showLocked ? (
                  <span className="absolute -left-2.5 -top-2 grid size-3.5 place-items-center text-muted-foreground">
                    <LockKeyhole className="size-3" />
                  </span>
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

function listingTypeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function unavailableListingLabel(status: string) {
  if (status === "sold" || status === "sold_externally") return "Sold";
  if (status === "archived") return "Archived";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "expired") return "Expired";

  return "No longer available";
}

function ProfileListingCard({
  listing,
  savedByViewer = false,
}: {
  listing: ProfileListing;
  savedByViewer?: boolean;
}) {
  const listingCard: ListingCardData = {
    bathrooms: listing.bathrooms,
    bedrooms: listing.bedrooms,
    buyerIncentive: listing.buyerIncentive,
    coverImageUrl: listing.coverImageUrl,
    erfSize: listing.erfSize,
    features: listing.features,
    floorSize: listing.floorSize,
    garages: listing.garages,
    href: listing.href || `/listings/${listing.id}`,
    id: listing.id,
    imageUrls: listing.imageUrls,
    likedByViewer: listing.likedByViewer,
    likeCount: listing.likeCount,
    likeCountLabel: listing.likeCountLabel,
    listingType: listing.listingType,
    listingTypeLabel: listingTypeLabel(listing.listingType),
    location: listing.location,
    mandateEndDate: listing.mandateEndDate,
    mandateStartDate: listing.mandateStartDate,
    mandateType: listing.mandateType,
    parking: listing.parking,
    previousPriceCents: listing.previousAskingPriceCents,
    priceCents: listing.askingPriceCents,
    priceLabel: listing.priceLabel,
    propertyTypeLabel: listingTypeLabel(listing.propertyType),
    savedByViewer: savedByViewer || listing.savedByViewer,
    saveCount: listing.saveCount,
    saveCountLabel: listing.saveCountLabel,
    status: listing.status,
    statusLabel: listing.statusLabel,
    title: listing.title,
    unavailable: listing.unavailable,
    unavailableLabel:
      listing.unavailableLabel ||
      (listing.unavailable ? unavailableListingLabel(listing.status) : undefined),
    videoUrls: listing.videoUrls,
  };

  return <ListingCard listing={listingCard} />;
}

function ProfileTabPanel({
  activeTab,
  listings,
  reels,
  savedListings,
  savedReels,
  username,
}: {
  activeTab: ProfileTab;
  listings: ProfileListing[];
  reels: ProfileReel[];
  savedListings: ProfileListing[];
  savedReels: ProfileReel[];
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
      title: "No saved homes or reels yet",
      description: "Saved listings and reels this profile wants to revisit will appear here.",
    },
  };
  const emptyState = emptyStates[activeTab];
  const hasSavedItems = savedListings.length > 0 || savedReels.length > 0;

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
      {activeTab === "listings" && listings.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ProfileListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : null}
      {activeTab === "saved" && hasSavedItems ? (
        <div className="space-y-8">
          {savedReels.length ? (
            <div>
              <h2 className="mb-4 text-base font-black">Saved reels</h2>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4">
                {savedReels.map((reel) => (
                  <ProfileReelCard
                    key={reel.id}
                    reel={reel}
                    username={username}
                    watched={watchedReelIds.has(reel.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {savedListings.length ? (
            <div>
              <h2 className="mb-4 text-base font-black">Saved listings</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {savedListings.map((listing) => (
                  <ProfileListingCard
                    key={listing.id}
                    listing={listing}
                    savedByViewer
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {activeTab === "reels" && reels.length ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4">
          {reels.map((reel) => (
            <ProfileReelCard
              key={reel.id}
              reel={reel}
              username={username}
              watched={watchedReelIds.has(reel.id)}
            />
          ))}
        </div>
      ) : activeTab !== "listings" && activeTab !== "saved" ? (
        <div>
          <EmptyState title={emptyState.title} description={emptyState.description} />
        </div>
      ) : activeTab === "saved" && !hasSavedItems ? (
        <div>
          <EmptyState title={emptyState.title} description={emptyState.description} />
        </div>
      ) : listings.length ? null : (
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
  const href =
    reel.status === "published" ? `/users/${username}/reels` : reel.editHref;

  return (
    <ReelPreviewCard
      reel={{
        coverUrl: reel.coverUrl,
        durationLabel: reel.durationLabel,
        href,
        id: reel.id,
        renderProgress: reel.renderProgress,
        status: reel.status,
        viewCountLabel: reel.viewCountLabel,
        watched,
      }}
    />
  );
}

function MobileBottomNav({
  viewerUsername,
  viewerAvatarUrl,
}: {
  viewerUsername?: string;
  viewerAvatarUrl?: string;
}) {
  const pathname = usePathname();
  const items = [
    { label: "Home", icon: Home, href: "/", active: true },
    { label: "Messages", icon: Send, href: "#" },
    {
      label: "Create",
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
                      "Create new"
                    }
                  >
                    <span className={iconWrapClassName}>
                      <Icon className="size-5" />
                    </span>
                  </button>
                </Dialog.Trigger>
                <CreateNewDialogContent />
              </Dialog.Root>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={pathname === item.href ? false : undefined}
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
  const [paymentSuccess, setPaymentSuccess] = useState(() => {
    if (typeof window === "undefined" || !hasActiveSubscription) {
      return { open: false, trialApplied: false };
    }

    const stored = window.sessionStorage.getItem("homzie-agent-payment-success");

    if (!stored) {
      return { open: false, trialApplied: false };
    }

    try {
      const parsed = JSON.parse(stored) as { trialApplied?: boolean };
      return { open: true, trialApplied: Boolean(parsed.trialApplied) };
    } catch {
      return { open: true, trialApplied: false };
    }
  });
  const open = paymentSuccess.open;
  const trialApplied = paymentSuccess.trialApplied;
  const setOpen = (nextOpen: boolean) =>
    setPaymentSuccess((current) => ({ ...current, open: nextOpen }));

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
            {trialApplied
              ? "Your Homzie Agent trial is active. Agent tools are now unlocked on your profile."
              : "Your Homzie Agent subscription is active. Agent tools are now unlocked on your profile."}
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    profile.initialTab || "reels",
  );
  const canViewSaved = profile.isOwner || profile.hasActiveSubscription;

  const handleTabChange = useCallback((tab: ProfileTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (tab === "reels") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    const query = nextParams.toString();
    const nextHref = query ? `${pathname}?${query}` : pathname;

    setActiveTab(tab);
    if (
      typeof window === "undefined" ||
      `${window.location.pathname}${window.location.search}` === nextHref
    ) {
      return;
    }

    router.replace(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (activeTab === "saved" && !canViewSaved) {
      const timeout = window.setTimeout(() => handleTabChange("reels"), 0);

      return () => window.clearTimeout(timeout);
    }
  }, [activeTab, canViewSaved, handleTabChange]);

  useEffect(() => {
    if (profile.isOwner) {
      return;
    }

    const sessionStorageKey = `homzie-profile-view:${profile.id}`;
    const localStorageKey = "homzie-profile-viewer-session";

    if (window.sessionStorage.getItem(sessionStorageKey)) {
      return;
    }

    let viewerSessionId = window.localStorage.getItem(localStorageKey);

    if (!viewerSessionId) {
      viewerSessionId = crypto.randomUUID();
      window.localStorage.setItem(localStorageKey, viewerSessionId);
    }

    let aborted = false;

    void (async () => {
      const response = await fetch("/api/users/profile-view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileUserId: profile.id,
          source: "profile_page",
          viewerSessionId,
        }),
      });

      if (!aborted && response.ok) {
        window.sessionStorage.setItem(sessionStorageKey, "1");
      }
    })().catch(() => {
      // Ignore tracking failures so they never disrupt the profile experience.
    });

    return () => {
      aborted = true;
    };
  }, [profile.id, profile.isOwner]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerHasAgencyWorkspace={profile.viewerHasAgencyWorkspace}
        viewerRole={profile.viewerRole}
        viewerUsername={profile.viewerUsername}
      />
      <main className="page-body pb-24 pt-20">
        <ProfileHero profile={profile} />
        {profile.archiveFeedback ? (
          <section className="page-container pb-6">
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
              {profile.archiveFeedback}
            </div>
          </section>
        ) : null}
        {profile.isOwner && !profile.hasActiveSubscription ? <AgentBrandCta /> : null}
        <ProfileTabs
          activeTab={activeTab}
          canViewSaved={canViewSaved}
          isLocked={false}
          listingCount={profile.listings.length}
          onTabChange={handleTabChange}
          reelCount={profile.reels.length}
          savedCount={profile.savedListings.length + profile.savedReels.length}
        />
        <ProfileTabPanel
          activeTab={activeTab}
          listings={profile.listings}
          reels={profile.reels}
          savedListings={profile.savedListings}
          savedReels={profile.savedReels}
          username={profile.username}
        />
      </main>
      <GlobalFooter
        viewerRole={profile.viewerRole}
        viewerUsername={profile.viewerUsername}
      />
      <MobileBottomNav
        viewerUsername={profile.viewerUsername}
        viewerAvatarUrl={profile.viewerAvatarUrl}
      />
      <AgentPaymentStatusDialog
        hasActiveSubscription={profile.hasActiveSubscription}
      />
    </div>
  );
}
