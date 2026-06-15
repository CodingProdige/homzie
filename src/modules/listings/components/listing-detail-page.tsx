"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Calculator,
  Edit3,
  Eye,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  HandCoins,
  Home,
  Lock,
  MapPin,
  ParkingCircle,
  Percent,
  Play,
  RefreshCcw,
  Ruler,
  Send,
  ShieldCheck,
  Trees,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/modules/currency/currency-provider";
import {
  getListingLiveIntentAction,
  getListingOfferStatsAction,
  trackListingPresence,
  trackListingAction,
  trackListingView,
} from "@/modules/listings/actions";
import {
  ListingEngagementActions,
  ListingSaveButton,
} from "@/modules/listings/components/listing-card";
import { mandateTypeOptions } from "@/modules/listings/options";
import type { ListingDetailData } from "@/modules/listings/server/listing-data";
import {
  createOfferMessageAction,
  startListingInquiryAction,
} from "@/modules/messages/actions";
import { ChatNowButton } from "@/modules/messages/components/chat-now-button";
import { ReportContentButton } from "@/modules/moderation/report-content-button";

function featureHashtag(value: string) {
  return `#${value.replace(/\s+/g, "")}`;
}

function formatMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

function formatDate(value: string) {
  if (!value) return "Dates not set";

  return value;
}

function mandateDates(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `Starts ${startDate}`;
  if (endDate) return `Ends ${endDate}`;

  return "Dates not set";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function amountToCents(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ""));

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function formatOfferAmount(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

type ListingOfferStats = {
  averageAmountCents: number | null;
  count: number;
  currency: string;
  maxAmountCents: number | null;
  minAmountCents: number | null;
};

function getOfferStrengthScore({
  amountCents,
  askingPriceCents,
  stats,
}: {
  amountCents: number;
  askingPriceCents: number | null;
  stats: ListingOfferStats | null;
}) {
  if (
    stats?.count &&
    stats.minAmountCents !== null &&
    stats.maxAmountCents !== null
  ) {
    if (stats.maxAmountCents > stats.minAmountCents) {
      return clampPercent(
        ((amountCents - stats.minAmountCents) /
          (stats.maxAmountCents - stats.minAmountCents)) *
          100,
      );
    }

    return amountCents >= stats.maxAmountCents ? 85 : 30;
  }

  if (askingPriceCents && askingPriceCents > 0) {
    const deltaRatio = (amountCents - askingPriceCents) / askingPriceCents;

    return clampPercent(50 + deltaRatio * 500);
  }

  return 50;
}

function OfferStrengthInsight({
  amountCents,
  askingPriceCents,
  loading,
  stats,
}: {
  amountCents: number;
  askingPriceCents: number | null;
  loading: boolean;
  stats: ListingOfferStats | null;
}) {
  if (!amountCents) return null;

  const score = getOfferStrengthScore({ amountCents, askingPriceCents, stats });
  const strength =
    score >= 75 ? "Hot" : score >= 40 ? "Medium" : "Cold";
  const deltaPercent =
    askingPriceCents && askingPriceCents > 0
      ? ((amountCents - askingPriceCents) / askingPriceCents) * 100
      : null;
  const deltaLabel =
    deltaPercent === null
      ? null
      : Math.abs(deltaPercent) < 0.05
        ? "At asking price"
        : deltaPercent > 0
          ? `${Math.abs(deltaPercent).toFixed(1)}% increase above asking`
          : `${Math.abs(deltaPercent).toFixed(1)}% deduction from asking`;
  const statsLabel = loading
    ? "Checking competing offers..."
    : stats?.count
      ? `Compared with ${stats.count} active ${stats.count === 1 ? "offer" : "offers"} in ${stats.currency}.`
      : "No active competing offers in this currency yet.";

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary">
            Offer strength
          </p>
          <p className="mt-1 text-sm font-black">{strength}</p>
        </div>
        {deltaLabel ? (
          <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-black text-muted-foreground">
            {deltaLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500">
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-md"
            style={{ left: `${score}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          <span>Cold</span>
          <span>Medium</span>
          <span>Hot</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
        {statsLabel}
      </p>
    </div>
  );
}

function getListingViewerSessionId() {
  if (typeof window === "undefined") return "";

  const storageKey = "homzie-listing-viewer-session";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) return existing;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(storageKey, nextId);

  return nextId;
}

function createListingViewInstanceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function DetailStat({
  icon: Icon,
  value,
}: {
  icon: typeof BedDouble;
  value: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-foreground">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span>{value}</span>
    </span>
  );
}

function ListingOfferCountPill({ countLabel }: { countLabel: string }) {
  return (
    <span
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/90 px-3 text-sm font-black shadow-sm backdrop-blur"
      title="Offers made on this listing"
    >
      <HandCoins className="size-4" />
      <span>{countLabel}</span>
    </span>
  );
}

type LiveIntentBuyer = {
  avatarUrl: string | null;
  durationSeconds?: number;
  id: string;
  lastSeenAt: string;
  name: string;
  profileHref: string | null;
  username: string | null;
  viewCount: number;
};

type LiveIntentActivity = {
  actionType: string | null;
  activityType: "action" | "view";
  buyer: LiveIntentBuyer;
  createdAt: string;
};

type LiveIntentState = {
  activeBuyerCount: number;
  activeViewerCount: number;
  averageSeconds?: number;
  buyers: LiveIntentBuyer[];
  ok: boolean;
  previousViews24h?: number;
  recentActivities?: LiveIntentActivity[];
  returningViewerCount?: number;
  totalViews24h?: number;
};

function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "B";
}

function relativeLiveTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (!Number.isFinite(seconds) || seconds < 15) return "active now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);

  return `${minutes}m ago`;
}

function formatDuration(seconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  if (minutes <= 0) return `${remainder}s`;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const extraMinutes = minutes % 60;

    return extraMinutes ? `${hours}h ${extraMinutes}m` : `${hours}h`;
  }

  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function trendLabel(current: number, previous: number) {
  if (current === 0 && previous === 0) return "No change vs yesterday";
  if (previous === 0) return current > 0 ? "Up 100% vs yesterday" : "No change vs yesterday";

  const percent = Math.round(((current - previous) / previous) * 100);

  if (percent === 0) return "No change vs yesterday";

  return `${percent > 0 ? "Up" : "Down"} ${Math.abs(percent)}% vs yesterday`;
}

function liveActivityLabel(activity: LiveIntentActivity) {
  if (activity.activityType === "view") return "viewing the listing";

  switch (activity.actionType) {
    case "bond_calculator":
      return "opened bond calculator";
    case "gallery_next":
    case "gallery_previous":
      return "browsed photos";
    case "like":
      return "liked the listing";
    case "media_thumbnail":
      return "opened listing media";
    case "media_video_play":
      return "played listing video";
    case "place_offer":
      return "started an offer";
    case "save":
      return "saved the listing";
    case "share":
      return "shared the listing";
    default:
      return "interacted with the listing";
  }
}

function liveActivityBadge(activity: LiveIntentActivity) {
  if (activity.activityType === "view") {
    return {
      className: "bg-primary/10 text-primary",
      label: "View",
    };
  }

  switch (activity.actionType) {
    case "bond_calculator":
      return {
        className: "bg-emerald-50 text-emerald-700",
        label: "Calculator",
      };
    case "call_agent":
    case "contact_agent":
    case "email_agent":
    case "whatsapp_agent":
      return {
        className: "bg-blue-50 text-blue-700",
        label: "Contact",
      };
    case "like":
      return {
        className: "bg-rose-50 text-rose-600",
        label: "Like",
      };
    case "place_offer":
    case "reserve_now":
      return {
        className: "bg-rose-50 text-rose-600",
        label: "Offer",
      };
    case "save":
      return {
        className: "bg-amber-50 text-amber-700",
        label: "Saved",
      };
    case "share":
      return {
        className: "bg-violet-50 text-violet-700",
        label: "Shared",
      };
    default:
      return {
        className: "bg-muted text-muted-foreground",
        label: "Action",
      };
  }
}

function BuyerAvatar({
  buyer,
  className = "",
  size = "md",
}: {
  buyer: Pick<LiveIntentBuyer, "avatarUrl" | "name">;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "size-12 sm:size-14"
      : size === "sm"
        ? "size-8 sm:size-10"
        : "size-9 sm:size-11";
  const textClass = size === "lg" ? "text-sm sm:text-base" : size === "sm" ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm";

  if (buyer.avatarUrl) {
    return (
      <Image
        src={buyer.avatarUrl}
        alt=""
        width={size === "lg" ? 56 : size === "sm" ? 32 : 44}
        height={size === "lg" ? 56 : size === "sm" ? 32 : 44}
        className={cn(sizeClass, "rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClass,
        textClass,
        "grid shrink-0 place-items-center rounded-full bg-primary font-black text-primary-foreground",
        className,
      )}
    >
      {initialsForName(buyer.name)}
    </span>
  );
}

function IntentViewerRow({
  buyer,
  listingId,
  tone,
}: {
  buyer: LiveIntentBuyer;
  listingId: string;
  tone: "high" | "low";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-border/70 px-2.5 py-2 last:border-b-0 sm:gap-3 sm:px-3 sm:py-3">
      <span className="relative shrink-0">
        <BuyerAvatar buyer={buyer} size="sm" />
        {tone === "high" ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500 sm:size-3.5" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black sm:text-sm">{buyer.name}</p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">
          Viewed {buyer.viewCount} {buyer.viewCount === 1 ? "time" : "times"}
          <span className="px-1.5">•</span>
          Last seen {relativeLiveTime(buyer.lastSeenAt)}
        </p>
      </div>
      <div className="grid shrink-0 justify-items-end gap-1">
        <ChatNowButton
          listingId={listingId}
          recipientUserId={buyer.id}
          surface={tone === "high" ? "intent-high" : "intent-low"}
        />
      </div>
    </div>
  );
}

function BuyerActivityStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof RefreshCcw;
  label: string;
  tone: "green" | "purple";
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 sm:gap-3 sm:px-4 sm:py-2.5 md:border-b-0 md:border-r md:last:border-r-0">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full sm:size-9",
          tone === "green" ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-3.5 sm:size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black sm:text-sm">{value}</span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">
          {label}
        </span>
      </span>
    </div>
  );
}

function ActivityFeedRow({ activity }: { activity: LiveIntentActivity }) {
  const buyer = activity.buyer;
  const badge = liveActivityBadge(activity);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr),auto] gap-x-2 gap-y-1 border-t border-border py-1.5 text-xs first:border-t-0 sm:flex sm:items-center sm:gap-3">
      <p className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap leading-none sm:shrink-0">
        <span className="min-w-0 truncate font-black">{buyer.name}</span>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase leading-none",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </p>
      <span className="shrink-0 whitespace-nowrap text-right text-[11px] font-semibold leading-none text-muted-foreground sm:order-3">
        {relativeLiveTime(activity.createdAt)}
      </span>
      <p className="col-span-2 min-w-0 truncate whitespace-nowrap font-semibold leading-none text-muted-foreground sm:col-span-1 sm:flex sm:flex-1">
        <span className="min-w-0 truncate text-muted-foreground">
          {liveActivityLabel(activity)}
        </span>
      </p>
    </div>
  );
}

function OwnerLiveIntentPanel({
  intent,
  listingId,
}: {
  intent: LiveIntentState | null;
  listingId: string;
}) {
  if (!intent?.ok) return null;

  const buyers = intent.buyers;
  const highIntentBuyers = buyers.filter((buyer) => buyer.viewCount > 1);
  const lowIntentBuyers = buyers.filter((buyer) => buyer.viewCount <= 1);
  const visibleHighIntentBuyers = highIntentBuyers.slice(0, 8);
  const visibleLowIntentBuyers = lowIntentBuyers.slice(0, 8);
  const recentActivity: LiveIntentActivity[] = (
    intent.recentActivities?.length
      ? intent.recentActivities
      : buyers.map((buyer) => ({
          actionType: null,
          activityType: "view" as const,
          buyer,
          createdAt: buyer.lastSeenAt,
        }))
  )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 8);
  const avatarBuyers = buyers.slice(0, 5);
  const extraBuyerCount = Math.max(0, buyers.length - avatarBuyers.length);
  const totalViews24h = intent.totalViews24h || 0;
  const previousViews24h = intent.previousViews24h || 0;

  return (
    <section className="mt-5 w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xl shadow-black/5 sm:mt-6">
      <div className="min-w-0 p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-primary sm:gap-2 sm:text-xs">
                <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(123,92,255,0.7)] sm:size-3" />
                Buyer activity
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-primary sm:px-3 sm:py-1 sm:text-xs">
                Live
              </span>
            </div>
            <h2 className="mt-2 text-lg font-black tracking-tight sm:mt-3 sm:text-3xl">
              {intent.activeViewerCount} active{" "}
              {intent.activeViewerCount === 1 ? "viewer" : "viewers"}
            </h2>
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-xs font-black sm:mt-2 sm:gap-2 sm:text-sm">
              <TrendingUp className="size-3.5 text-emerald-500 sm:size-4" />
              <span className="min-w-0 truncate">{trendLabel(totalViews24h, previousViews24h)}</span>
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <Eye className="size-4 text-muted-foreground sm:size-5" />
              <div>
                <p className="text-[11px] font-black sm:text-sm">{totalViews24h} total views</p>
                <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground sm:text-xs">
                  Last 24 hours
                </p>
              </div>
            </div>
            <Link
              href={`/listings/${listingId}/activity`}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-[11px] font-black text-primary transition-colors hover:bg-primary/10 sm:h-9 sm:text-xs"
            >
              View all
              <ArrowRight className="size-3 sm:size-3.5" />
            </Link>
            {avatarBuyers.length ? (
              <div className="hidden items-center border-l border-border pl-5 sm:flex">
                {avatarBuyers.map((buyer, index) => (
                  <BuyerAvatar
                    key={buyer.id}
                    buyer={buyer}
                    className={cn(index > 0 && "-ml-3", "border-2 border-card")}
                    size="sm"
                  />
                ))}
                {extraBuyerCount ? (
                  <span className="-ml-3 grid size-10 place-items-center rounded-full border-2 border-card bg-primary/10 text-xs font-black text-primary">
                    +{extraBuyerCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-4 sm:mt-8 sm:gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-rose-200 bg-rose-50/20 p-3 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2.5 sm:mb-4 sm:gap-3">
              <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                <span className="grid h-7 w-7 min-w-7 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 sm:h-9 sm:w-9 sm:min-w-9">
                  <Flame className="size-3.5 shrink-0 sm:size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black uppercase tracking-wide text-rose-600 sm:text-sm">
                    High intent
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground sm:mt-1 sm:text-sm">
                    Serious buyers showing strong interest
                  </p>
                </div>
              </div>
              <span className="grid h-6 w-6 min-w-6 shrink-0 place-items-center rounded-full bg-rose-500 text-[11px] font-black text-white sm:h-8 sm:w-8 sm:min-w-8 sm:text-sm">
                {highIntentBuyers.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-rose-100 bg-card">
              {visibleHighIntentBuyers.length ? (
                visibleHighIntentBuyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className="transition hover:bg-rose-50/45"
                  >
                    <IntentViewerRow
                      buyer={buyer}
                      listingId={listingId}
                      tone="high"
                    />
                  </div>
                ))
              ) : (
                <p className="p-3 text-xs font-semibold text-muted-foreground sm:p-4 sm:text-sm">
                  Repeat active buyers will appear here.
                </p>
              )}
              {highIntentBuyers.length > visibleHighIntentBuyers.length ? (
                <Link
                  href={`/listings/${listingId}/activity`}
                  className="flex items-center justify-center gap-1 border-t border-rose-100 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
                >
                  View all {highIntentBuyers.length}
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}
            </div>

          </div>

          <div className="min-w-0 rounded-lg border border-blue-200 bg-blue-50/10 p-3 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2.5 sm:mb-4 sm:gap-3">
              <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                <span className="grid h-7 w-7 min-w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600 sm:h-9 sm:w-9 sm:min-w-9">
                  <Eye className="size-3.5 shrink-0 sm:size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black uppercase tracking-wide text-blue-600 sm:text-sm">
                    Low intent
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground sm:mt-1 sm:text-sm">
                    Browsing and exploring
                  </p>
                </div>
              </div>
              <span className="grid h-6 w-6 min-w-6 shrink-0 place-items-center rounded-full bg-blue-500 text-[11px] font-black text-white sm:h-8 sm:w-8 sm:min-w-8 sm:text-sm">
                {lowIntentBuyers.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-blue-100 bg-card">
              {visibleLowIntentBuyers.length ? (
                visibleLowIntentBuyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className="transition hover:bg-blue-50/45"
                  >
                    <IntentViewerRow
                      buyer={buyer}
                      listingId={listingId}
                      tone="low"
                    />
                  </div>
                ))
              ) : (
                <p className="p-3 text-xs font-semibold leading-5 text-muted-foreground sm:p-4 sm:text-sm">
                  First-time active buyers will appear here.
                </p>
              )}
              {lowIntentBuyers.length > visibleLowIntentBuyers.length ? (
                <Link
                  href={`/listings/${listingId}/activity`}
                  className="flex items-center justify-center gap-1 border-t border-blue-100 px-3 py-2 text-xs font-black text-blue-600 transition hover:bg-blue-50"
                >
                  View all {lowIntentBuyers.length}
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid overflow-hidden rounded-lg border border-border sm:mt-4 md:grid-cols-3">
          <BuyerActivityStat
            icon={RefreshCcw}
            label="People who came back to view again"
            tone="purple"
            value={`${intent.returningViewerCount || 0} returning viewers`}
          />
          <BuyerActivityStat
            icon={Clock3}
            label="Average time on listing"
            tone="purple"
            value={formatDuration(intent.averageSeconds)}
          />
          <BuyerActivityStat
            icon={TrendingUp}
            label="More activity than similar listings"
            tone="green"
            value={highIntentBuyers.length ? "High interest" : "Building interest"}
          />
        </div>

        <div className="mt-3 min-w-0 rounded-lg border border-border p-2.5 sm:mt-4 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-wide text-primary sm:text-xs">
              Recent activity feed
            </h3>
            <Link
              href={`/listings/${listingId}/activity`}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-primary hover:underline sm:text-xs"
            >
              View all
              <ArrowRight className="size-3 sm:size-3.5" />
            </Link>
          </div>
          {recentActivity.length ? (
            recentActivity.map((activity) => (
              <ActivityFeedRow
                key={`${activity.activityType}:${activity.actionType || "view"}:${activity.buyer.id}:${activity.createdAt}`}
                activity={activity}
              />
            ))
          ) : (
            <p className="border-t border-border py-2 text-xs font-semibold text-muted-foreground">
              Active buyer activity will appear here.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/15 px-4 py-3 text-xs font-semibold text-muted-foreground sm:px-6">
        <span className="inline-flex min-w-0 items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            Buyer activity is private and you control who you message.
          </span>
        </span>
      </div>
    </section>
  );
}

function ListingMetaPanel({ listing }: { listing: ListingDetailData }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm font-bold text-muted-foreground shadow-sm">
      <p className="flex items-center gap-2">
        <Home className="size-4" />
        {listing.propertyTypeLabel}
      </p>
      <p className="flex items-center gap-2">
        <CalendarDays className="size-4" />
        Listed {formatDate(listing.listedAt.slice(0, 10))}
      </p>
      <p className="flex items-center gap-2">
        <ShieldCheck className="size-4" />
        {statusLabel(listing.status)}
      </p>
    </div>
  );
}

function yesNoLabel(value: string) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";

  return "";
}

function DetailDataTable({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.label} className="transition hover:bg-muted/35">
              <th
                scope="row"
                className="w-[46%] px-4 py-3 align-top text-xs font-black uppercase tracking-wide text-muted-foreground sm:w-1/3 sm:px-5"
              >
                {item.label}
              </th>
              <td className="break-words px-4 py-3 align-top font-black sm:px-5">
                {item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BondCalculatorDialog({
  askingPriceCents,
  buyerIncentive,
  onOpen,
  transferCostsEstimateCents,
  formatPriceCents,
  triggerClassName,
}: {
  askingPriceCents: number;
  buyerIncentive: string | null;
  onOpen?: () => void;
  transferCostsEstimateCents: number | null;
  formatPriceCents: (value: number) => string;
  triggerClassName?: string;
}) {
  const [depositAmount, setDepositAmount] = useState("0");
  const [interestRate, setInterestRate] = useState("10.5");
  const [loanTermYears, setLoanTermYears] = useState(20);
  const depositCents = amountToCents(depositAmount);
  const principalCents = Math.max(0, askingPriceCents - depositCents);
  const monthlyRate = Math.max(0, Number(interestRate) || 0) / 100 / 12;
  const numberOfPayments = loanTermYears * 12;
  const monthlyRepaymentCents =
    numberOfPayments > 0 && monthlyRate > 0
      ? Math.round(
          principalCents *
            ((monthlyRate * (1 + monthlyRate) ** numberOfPayments) /
              ((1 + monthlyRate) ** numberOfPayments - 1)),
        )
      : numberOfPayments > 0
        ? Math.round(principalCents / numberOfPayments)
        : 0;
  const minimumIncomeCents = Math.round(monthlyRepaymentCents * 3.33);
  const onceOffCostsCents = transferCostsEstimateCents || 0;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" className={triggerClassName} onClick={onOpen}>
          <Calculator className="size-4" />
          Bond calculator
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[91] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-2xl focus-visible:outline-none sm:mx-auto sm:max-w-3xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-black">
                Bond calculator
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                Estimate repayments using this listing&apos;s price.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close calculator">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Purchase price</span>
                  <div className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-sm font-black">
                    {formatPriceCents(askingPriceCents)}
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Deposit</span>
                  <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                    <span className="text-sm font-black text-primary">
                      {formatPriceCents(0).replace(/[0-9.,\s]+/g, "").trim() ||
                        "R"}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Interest rate</span>
                  <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={interestRate}
                      onChange={(event) => setInterestRate(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                    <Percent className="size-4 text-primary" />
                  </div>
                </label>

                <label className="grid gap-3">
                  <span className="flex items-center justify-between gap-3 text-sm font-black">
                    Loan term
                    <span className="text-primary">{loanTermYears} years</span>
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={loanTermYears}
                    onChange={(event) =>
                      setLoanTermYears(Number(event.target.value))
                    }
                    className="h-2 w-full accent-primary"
                  />
                </label>
              </div>
            </div>

            <div className="grid content-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div>
                <p className="text-sm font-bold text-muted-foreground">
                  Monthly repayment
                </p>
                <p className="mt-1 text-2xl font-black text-primary">
                  {formatPriceCents(monthlyRepaymentCents)}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-start justify-between gap-3 text-sm font-semibold">
                <span className="text-muted-foreground">
                  Once-off costs estimate
                </span>
                <span className="font-black">
                  {onceOffCostsCents
                    ? formatPriceCents(onceOffCostsCents)
                    : "Not supplied"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm font-semibold">
                <span className="text-muted-foreground">
                  Suggested gross monthly income
                </span>
                <span className="font-black">
                  {formatPriceCents(minimumIncomeCents)}
                </span>
              </div>
              {buyerIncentive ? (
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-primary">
                  {buyerIncentive}
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-4 text-xs font-medium leading-5 text-muted-foreground">
            This is an estimate only. Actual repayment, fees, taxes and approval
            requirements depend on the lender, jurisdiction and your personal
            affordability assessment.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MakeOfferDialog({
  currencyPrefix,
  listing,
  onOfferStarted,
}: {
  currencyPrefix: string;
  listing: ListingDetailData;
  onOfferStarted?: () => void;
}) {
  const router = useRouter();
  const { currency } = useCurrency();
  const [amount, setAmount] = useState(
    listing.askingPriceCents
      ? formatOfferAmount(String(Math.round(listing.askingPriceCents / 100)))
      : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [offerStats, setOfferStats] = useState<ListingOfferStats | null>(null);
  const [offerStatsPending, startOfferStatsTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const amountCents = amountToCents(amount);

  useEffect(() => {
    let active = true;

    startOfferStatsTransition(async () => {
      try {
        const stats = await getListingOfferStatsAction({
          currency,
          listingId: listing.id,
        });

        if (active) setOfferStats(stats);
      } catch {
        if (active) setOfferStats(null);
      }
    });

    return () => {
      active = false;
    };
  }, [currency, listing.id]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" onClick={onOfferStarted}>
          Place offer
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[91] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-2xl focus-visible:outline-none sm:mx-auto sm:max-w-lg sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-black">
                Make an offer
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                Your offer will start a direct conversation with the agent and
                attach this listing.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close offer">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
              <p className="line-clamp-2 text-sm font-black">{listing.title}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {listing.location || listing.city || "Listing"}
              </p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-black">Offer amount</span>
              <div className="flex h-12 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                <span className="text-sm font-black text-primary">
                  {currencyPrefix}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(formatOfferAmount(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </label>

            <OfferStrengthInsight
              amountCents={amountCents}
              askingPriceCents={listing.askingPriceCents}
              loading={offerStatsPending}
              stats={offerStats}
            />

            <label className="grid gap-2">
              <span className="text-sm font-black">Message</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Add a note for the agent..."
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            {error ? (
              <p className="text-sm font-bold text-destructive">{error}</p>
            ) : null}

            <Button
              type="button"
              disabled={pending || !amount}
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try {
                    const result = await createOfferMessageAction({
                      amountCents,
                      currency,
                      listingId: listing.id,
                      note,
                    });

                    router.push(`/messages?conversation=${result.conversationId}`);
                  } catch (offerError) {
                    setError(
                      offerError instanceof Error
                        ? offerError.message
                        : "Could not send this offer.",
                    );
                  }
                });
              }}
            >
              {pending ? "Sending offer..." : "Send offer"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SendListingMessageButton({
  listing,
  onSent,
}: {
  listing: ListingDetailData;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        className="h-12 w-full rounded-md border-transparent bg-[image:var(--homzie-gradient)] text-sm font-black text-white shadow-[0_14px_30px_rgba(123,92,255,0.25)] hover:opacity-95"
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const listingUrl =
                typeof window !== "undefined"
                  ? new URL(listing.href, window.location.origin).toString()
                  : listing.href;
              const clientId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? `listing-inquiry-${crypto.randomUUID()}`
                  : `listing-inquiry-${Date.now()}`;
              const result = await startListingInquiryAction({
                body: `Hi ${listing.agent.name}, I'm interested in this listing: ${listing.title}\n${listingUrl}`,
                clientId,
                listingId: listing.id,
              });

              onSent?.();
              router.push(`/messages?conversation=${result.conversationId}`);
            } catch (messageError) {
              setError(
                messageError instanceof Error
                  ? messageError.message
                  : "Could not start this chat.",
              );
            }
          });
        }}
      >
        <Send className="size-4" />
        {pending ? "Opening chat..." : "Send message"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function ListingDescription({ value }: { value: string | null }) {
  if (!value) {
    return (
      <p className="text-sm font-normal leading-7 text-muted-foreground">
        No description has been added yet.
      </p>
    );
  }

  return (
    <div
      className="space-y-4 text-sm font-normal leading-7 text-foreground/80 [&_em]:italic [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-bold [&_ul]:space-y-2"
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

function AgentProfileCard({
  agentHref,
  listing,
  locked,
  onAction,
}: {
  agentHref: string;
  listing: ListingDetailData;
  locked?: boolean;
  onAction?: (
    actionType: "call_agent" | "contact_agent" | "email_agent" | "whatsapp_agent",
  ) => void;
}) {
  const actionsDisabled = listing.isUnavailableForViewer;
  const signupHref = `/register?callbackUrl=${encodeURIComponent(listing.href)}`;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div
        className={cn(
          "transition",
          locked && "pointer-events-none select-none blur-sm",
        )}
        aria-hidden={locked ? true : undefined}
      >
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-black text-primary ring-4 ring-primary/10">
            {listing.agent.avatarUrl ? (
              <Image
                src={listing.agent.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="size-full object-cover"
              />
            ) : (
              listing.agent.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-black">{listing.agent.name}</p>
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 ring-2 ring-background"
                title="Verified Homzie agent"
              >
                <BadgeCheck className="size-3.5" />
              </span>
            </div>
            <p className="truncate text-xs font-bold text-muted-foreground">
              {listing.agent.username
                ? `@${listing.agent.username}`
                : "Homzie agent"}
            </p>
            {listing.agent.location ? (
              <p className="mt-2 truncate text-xs font-bold text-muted-foreground">
                {listing.agent.location}
              </p>
            ) : null}
          </div>
        </div>
        {listing.agent.bio ? (
          <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-foreground/80">
            {listing.agent.bio}
          </p>
        ) : null}
        {listing.agent.contactEmail ||
        listing.agent.contactPhone ||
        listing.agent.whatsappNumber ? (
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Contact agent
            </p>
            <div className="mt-1 flex max-w-full flex-col items-start gap-1 text-sm font-bold text-primary">
            {listing.agent.contactEmail ? (
              actionsDisabled ? (
                <span className="max-w-full break-all text-muted-foreground">
                  {listing.agent.contactEmail}
                </span>
              ) : (
                <a
                  href={`mailto:${listing.agent.contactEmail}`}
                  className="max-w-full break-all hover:underline"
                  onClick={() => onAction?.("email_agent")}
                >
                  {listing.agent.contactEmail}
                </a>
              )
            ) : null}
            {listing.agent.contactPhone ? (
              actionsDisabled ? (
                <span className="text-muted-foreground">
                  {listing.agent.contactPhone}
                </span>
              ) : (
                <a
                  href={`tel:${listing.agent.contactPhone}`}
                  className="hover:underline"
                  onClick={() => onAction?.("call_agent")}
                >
                  {listing.agent.contactPhone}
                </a>
              )
            ) : null}
            {listing.agent.whatsappNumber ? (
              actionsDisabled ? (
                <span className="text-muted-foreground">
                  WhatsApp {listing.agent.whatsappNumber}
                </span>
              ) : (
                <a
                  href={`https://wa.me/${listing.agent.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                  onClick={() => onAction?.("whatsapp_agent")}
                >
                  WhatsApp {listing.agent.whatsappNumber}
                </a>
              )
            ) : null}
            </div>
          </div>
        ) : null}
        {actionsDisabled ? (
          <div className="mt-4 grid gap-2">
            <Button className="h-12 w-full rounded-md border-transparent bg-[image:var(--homzie-gradient)] text-sm font-black text-white opacity-60 shadow-[0_14px_30px_rgba(123,92,255,0.25)]" disabled>
              <Send className="size-4" />
              Send message
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-md" disabled>
              <Eye className="size-4" />
              View agent profile
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <SendListingMessageButton
              listing={listing}
              onSent={() => onAction?.("contact_agent")}
            />
            <Button asChild variant="outline" className="h-12 w-full rounded-md">
              <Link href={agentHref}>
                <Eye className="size-4" />
                View agent profile
              </Link>
            </Button>
          </div>
        )}
      </div>
      {locked ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background/55 p-5 text-center backdrop-blur-[1px]">
          <div className="max-w-64">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Eye className="size-5" />
            </span>
            <p className="mt-3 text-sm font-black">Create an account to reveal</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              Sign up to view agent details and contact this listing owner.
            </p>
            <Button asChild className="mt-4 h-10 w-full">
              <Link href={signupHref}>Reveal agent</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ListingDetailPage({
  listing,
  viewerSignedIn = false,
  viewerRole,
  viewerUsername,
}: {
  listing: ListingDetailData;
  viewerSignedIn?: boolean;
  viewerRole?: "user" | "admin";
  viewerUsername?: string;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [liveIntent, setLiveIntent] = useState<LiveIntentState | null>(null);
  const [, startLiveIntentTransition] = useTransition();
  const trackedListingViewRef = useRef<string | null>(null);
  const { formatPriceCents, formatPriceLabel } = useCurrency();
  const mediaItems = useMemo(
    () => {
      const seen = new Set<string>();
      const items: Array<{ type: string; url: string }> = [];

      if (listing.coverImageUrl) {
        seen.add(listing.coverImageUrl);
        items.push({ type: "image/webp", url: listing.coverImageUrl });
      }

      listing.media.forEach((item) => {
        if (!item.previewUrl || seen.has(item.previewUrl)) return;

        seen.add(item.previewUrl);
        items.push({
          type: item.type || "image/webp",
          url: item.previewUrl,
        });
      });

      return items;
    },
    [listing.coverImageUrl, listing.media],
  );
  const safeActiveMediaIndex = mediaItems.length
    ? Math.min(activeMediaIndex, mediaItems.length - 1)
    : 0;
  const activeMedia = mediaItems[safeActiveMediaIndex] || null;
  const activeMediaIsVideo = Boolean(activeMedia?.type.startsWith("video/"));
  const showGalleryControls = mediaItems.length > 1;
  const formattedPrice =
    listing.askingPriceCents && listing.askingPriceCents > 0
      ? formatPriceCents(listing.askingPriceCents)
      : formatPriceLabel(listing.priceLabel) || "Price not set";
  const currencyPrefix =
    formatPriceCents(0).replace(/[0-9.,\s]+/g, "").trim() || "R";
  const price =
    listing.listingType === "rental" &&
    listing.askingPriceCents &&
    listing.askingPriceCents > 0
      ? `${formattedPrice}/month`
      : formattedPrice;
  const showBondCalculator =
    !listing.isUnavailableForViewer &&
    listing.listingType !== "rental" &&
    Boolean(listing.askingPriceCents) &&
    Number(listing.askingPriceCents) > 0;
  const showReducedPrice =
    Boolean(listing.askingPriceCents) &&
    Number(listing.previousAskingPriceCents || 0) >
      Number(listing.askingPriceCents || 0);
  const canUseListingActions = !listing.isUnavailableForViewer;
  const mandateOption =
    mandateTypeOptions.find((option) => option.value === listing.mandateType) ||
    mandateTypeOptions[0];
  const MandateIcon = mandateOption.icon;
  const agentHref = listing.agent.username
    ? `/users/${listing.agent.username}`
    : "/agents";
  const ownershipCosts = [
    {
      label: "Local taxes",
      value: listing.localTaxesCents
        ? formatPriceCents(listing.localTaxesCents)
        : "",
    },
    {
      label: "Community fees",
      value: listing.communityFeesCents
        ? formatPriceCents(listing.communityFeesCents)
        : "",
    },
    {
      label: "Utilities estimate",
      value: listing.utilitiesEstimateCents
        ? formatPriceCents(listing.utilitiesEstimateCents)
        : "",
    },
    {
      label: "Insurance estimate",
      value: listing.insuranceEstimateCents
        ? formatPriceCents(listing.insuranceEstimateCents)
        : "",
    },
    {
      label: "Transfer costs estimate",
      value: listing.transferCostsEstimateCents
        ? formatPriceCents(listing.transferCostsEstimateCents)
        : "",
    },
    {
      label: "Rental yield estimate",
      value: listing.rentalYield ? `${listing.rentalYield}%` : "",
    },
  ].filter((item) => item.value);
  const availabilityDetails = [
    {
      label:
        listing.listingType === "rental"
          ? "Available from"
          : "Occupation / available date",
      value: listing.availableFrom || "",
    },
    {
      label: "Furnished",
      value: yesNoLabel(listing.furnishedStatus),
    },
    {
      label: "Pets allowed",
      value: yesNoLabel(listing.petsAllowed),
    },
    {
      label: "Short-let allowed",
      value: yesNoLabel(listing.shortLetAllowed),
    },
  ].filter((item) => item.value);
  const recordListingAction = (
    actionType:
      | "bond_calculator"
      | "call_agent"
      | "contact_agent"
      | "email_agent"
      | "gallery_next"
      | "gallery_previous"
      | "like"
      | "media_thumbnail"
      | "media_video_play"
      | "place_offer"
      | "reserve_now"
      | "save"
      | "share"
      | "whatsapp_agent",
  ) => {
    void trackListingAction({
      actionType,
      listingId: listing.id,
      source: "listing_detail",
      viewerSessionId: getListingViewerSessionId(),
    });
  };
  useEffect(() => {
    if (trackedListingViewRef.current === listing.id) return;

    trackedListingViewRef.current = listing.id;
    const viewerSessionId = getListingViewerSessionId();

    void trackListingView({
      listingId: listing.id,
      source: "listing_detail",
      viewInstanceId: createListingViewInstanceId(),
      viewerSessionId,
    }).catch((error) => console.error("[listing-intent] view tracking failed", error));
    void trackListingPresence({
      listingId: listing.id,
      source: "listing_detail",
      viewerSessionId,
    }).catch((error) =>
      console.error("[listing-intent] initial presence failed", error),
    );
  }, [listing.id]);
  useEffect(() => {
    const viewerSessionId = getListingViewerSessionId();

    const refreshPresence = () => {
      if (document.visibilityState !== "visible") return;

      void trackListingPresence({
        listingId: listing.id,
        source: "listing_detail",
        viewerSessionId,
      }).catch((error) =>
        console.error("[listing-intent] presence refresh failed", error),
      );
    };

    refreshPresence();

    const interval = window.setInterval(refreshPresence, 8000);

    document.addEventListener("visibilitychange", refreshPresence);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshPresence);
    };
  }, [listing.id]);
  useEffect(() => {
    if (!listing.isOwner) return;

    const refreshLiveIntent = () => {
      startLiveIntentTransition(async () => {
        try {
          const result = await getListingLiveIntentAction({ listingId: listing.id });

          setLiveIntent(result);
        } catch (error) {
          console.error("[listing-intent] live intent refresh failed", error);
          setLiveIntent({
            activeBuyerCount: 0,
            activeViewerCount: 0,
            buyers: [],
            ok: false,
          });
        }
      });
    };

    refreshLiveIntent();

    const interval = window.setInterval(refreshLiveIntent, 8000);

    return () => window.clearInterval(interval);
  }, [listing.id, listing.isOwner]);
  const showPreviousMedia = () => {
    recordListingAction("gallery_previous");
    setActiveMediaIndex((index) =>
      mediaItems.length ? (index - 1 + mediaItems.length) % mediaItems.length : 0,
    );
  };
  const showNextMedia = () => {
    recordListingAction("gallery_next");
    setActiveMediaIndex((index) =>
      mediaItems.length ? (index + 1) % mediaItems.length : 0,
    );
  };
  const editListingAction = listing.isOwner ? (
    <Button asChild>
      <Link href={`/listings/${listing.id}/edit`}>
        <Edit3 className="size-4" />
        Edit listing
      </Link>
    </Button>
  ) : null;
  const placeOfferAction = canUseListingActions && listing.listingType !== "rental" ? (
    <MakeOfferDialog
      currencyPrefix={currencyPrefix}
      listing={listing}
      onOfferStarted={() => recordListingAction("place_offer")}
    />
  ) : null;
  const purchaseActions = (
    <>
      {placeOfferAction}
    </>
  );
  const listingToolActions = canUseListingActions ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ListingEngagementActions
        listing={{
          id: listing.id,
          likedByViewer: listing.likedByViewer,
          likeCountLabel: listing.likeCountLabel,
          savedByViewer: listing.savedByViewer,
          saveCountLabel: listing.saveCountLabel,
        }}
        onLike={() => recordListingAction("like")}
        onSave={() => recordListingAction("save")}
      />
      <ListingOfferCountPill countLabel={listing.offerCountLabel} />
      {!listing.isOwner ? (
        <ReportContentButton
          label="Report listing"
          targetId={listing.id}
          targetLabel="listing"
          targetType="listing"
        />
      ) : null}
    </div>
  ) : listing.savedByViewer ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ListingSaveButton
        countLabel={listing.saveCountLabel}
        initialSaved={listing.savedByViewer}
        listingId={listing.id}
        onSave={() => recordListingAction("save")}
      />
      <ListingOfferCountPill countLabel={listing.offerCountLabel} />
    </div>
  ) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pt-20 pb-48 text-foreground lg:pb-0">
      <GlobalHeader viewerRole={viewerRole} viewerUsername={viewerUsername} />
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="relative aspect-[4/3] bg-muted sm:aspect-[16/10]">
                {activeMediaIsVideo && activeMedia ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    className={cn(
                      "size-full object-cover",
                      listing.isUnavailableForViewer && "grayscale",
                    )}
                    controls
                    playsInline
	                    preload="metadata"
	                    onPlay={() => recordListingAction("media_video_play")}
	                  />
                ) : activeMedia?.url ? (
                  <Image
                    src={activeMedia.url}
                    alt={listing.title}
                    fill
                    priority
                    className={cn(
                      "object-cover",
                      listing.isUnavailableForViewer && "grayscale",
                    )}
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Upload className="size-10" />
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                  {listing.isUnavailableForViewer
                    ? listing.statusLabel
                    : listing.listingTypeLabel}
                </span>
                {listing.buyerIncentive && canUseListingActions ? (
                  <span className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-foreground shadow-lg">
                    {listing.buyerIncentive}
                  </span>
                ) : null}
                {activeMediaIsVideo ? (
                  <span className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
                    <Play className="size-3 fill-current" />
                    Video
                  </span>
                ) : null}
                {showGalleryControls ? (
                  <>
                    <button
                      type="button"
                      aria-label="Previous listing media"
                      className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-black shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={showPreviousMedia}
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next listing media"
                      className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-black shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={showNextMedia}
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                ) : null}
              </div>
              {showGalleryControls ? (
                <div className="flex max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain p-3 [scrollbar-width:thin]">
                  {mediaItems.map((item, index) => {
                    const isVideo = item.type.startsWith("video/");

                    return (
                      <button
                        key={`${item.url}-${index}`}
                        type="button"
                        aria-label={`Show listing ${isVideo ? "video" : "image"} ${index + 1}`}
                        className={cn(
                          "relative h-16 w-24 shrink-0 snap-start overflow-hidden rounded-md border bg-muted",
                          index === safeActiveMediaIndex
                            ? "border-primary ring-2 ring-primary/25"
                            : "border-border",
                        )}
	                        onClick={() => {
	                          recordListingAction("media_thumbnail");
	                          setActiveMediaIndex(index);
	                        }}
                      >
                        {isVideo ? (
                          <>
                            <video
                              src={item.url}
                              className={cn(
                                "size-full object-cover",
                                listing.isUnavailableForViewer && "grayscale",
                              )}
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                              <Play className="size-5 fill-current drop-shadow" />
                            </span>
                          </>
                        ) : (
                          <Image
                            src={item.url}
                            alt=""
                            fill
                            className={cn(
                              "object-cover",
                              listing.isUnavailableForViewer && "grayscale",
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <section className="mt-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide text-primary">
                    {listing.isUnavailableForViewer
                      ? listing.statusLabel
                      : listing.propertyTypeLabel}
                  </p>
                  <h1 className="mt-2 max-w-4xl text-2xl font-black leading-tight sm:text-3xl">
                    {listing.title}
                  </h1>
                  <p className="mt-3 flex items-start gap-2 text-sm font-bold text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {listing.location || "Location not set"}
                  </p>
                  {listingToolActions}
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  {listing.isOwner ? editListingAction : null}
                </div>
              </div>
            </section>

            <section className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <DetailStat icon={BedDouble} value={`${formatMetric(listing.bedrooms)} beds`} />
              <DetailStat icon={Bath} value={`${formatMetric(listing.bathrooms)} baths`} />
              <DetailStat icon={Car} value={`${formatMetric(listing.garages)} garages`} />
              <DetailStat icon={ParkingCircle} value={`${formatMetric(listing.parking)} parking`} />
              <DetailStat icon={Ruler} value={`${formatMetric(listing.floorSize)}m² floor`} />
              <DetailStat icon={Trees} value={`${formatMetric(listing.erfSize)}m² erf`} />
            </section>

            {listing.isUnavailableForViewer ? (
              <section className="mt-6 rounded-lg border border-border bg-muted/60 p-5 text-foreground shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Listing {listing.statusLabel.toLowerCase()}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {listing.status === "reserved"
                    ? "This listing is reserved."
                    : "This listing is no longer active."}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {listing.status === "reserved"
                    ? "A buyer has paid the reservation amount. Buyer actions are disabled while the agent and agency confirm the deal."
                    : "The agent has removed, archived, or completed this listing. Listing actions are disabled. If it is saved, you can still remove it using the bookmark action above."}
                </p>
              </section>
            ) : null}

            {listing.features.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-black">Features</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary"
                    >
                      {featureHashtag(feature)}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 lg:hidden">
              <ListingMetaPanel listing={listing} />
            </section>

            {listing.isOwner ? (
              <OwnerLiveIntentPanel
                intent={liveIntent}
                listingId={listing.id}
              />
            ) : null}

            <section className="mt-8">
              <h2 className="text-xl font-black">Description</h2>
              <div className="mt-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
                <ListingDescription value={listing.description} />
              </div>
            </section>

            {ownershipCosts.length ? (
              <section className="mt-8">
                <div>
                  <h2 className="text-xl font-black">Ownership costs</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Local running costs and estimates added by the agent.
                  </p>
                </div>
                <DetailDataTable items={ownershipCosts} />
              </section>
            ) : null}

            {availabilityDetails.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-black">Availability and rules</h2>
                <DetailDataTable items={availabilityDetails} />
              </section>
            ) : null}

            {showBondCalculator ? (
              <section className="mt-8">
                <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-card text-card-foreground shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-1 [background:var(--homzie-gradient)]" />
                  <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Calculator className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-primary">
                          Buying tools
                        </p>
                        <h2 className="mt-1 text-xl font-black">
                          Bond calculator
                        </h2>
                        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                          Estimate the repayment, once-off costs and income guide for this listing.
                        </p>
                      </div>
                    </div>
                    <div className="sm:justify-self-end">
                      <BondCalculatorDialog
                        askingPriceCents={Number(listing.askingPriceCents)}
                        buyerIncentive={listing.buyerIncentive}
                        onOpen={() => recordListingAction("bond_calculator")}
                        transferCostsEstimateCents={listing.transferCostsEstimateCents}
                        formatPriceCents={formatPriceCents}
                        triggerClassName="w-full border-transparent [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 hover:opacity-95 sm:w-auto"
                      />
                      <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground sm:text-right">
                        Quick estimate only
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm lg:block">
              {listing.priceQualifier ? (
                <p className="text-xs font-black uppercase tracking-wide text-primary">
                  {listing.priceQualifier}
                </p>
              ) : null}
              <p className={listing.priceQualifier ? "mt-1 text-3xl font-black" : "text-3xl font-black"}>
                {price}
              </p>
              {showReducedPrice ? (
                <p className="mt-1 text-sm font-black text-red-600">
                  Reduced from{" "}
                  <span className="text-muted-foreground line-through">
                    {formatPriceCents(Number(listing.previousAskingPriceCents))}
                  </span>
                </p>
              ) : null}
              {listing.buyerIncentive && canUseListingActions ? (
                <p className="mt-4 inline-flex rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-foreground">
                  {listing.buyerIncentive}
                </p>
              ) : null}
              <div className="mt-5 grid gap-2">
                {canUseListingActions ? purchaseActions : null}
              </div>
            </div>

            <AgentProfileCard
              agentHref={agentHref}
              listing={listing}
              locked={!viewerSignedIn}
              onAction={recordListingAction}
            />

            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <MandateIcon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-black">{listing.mandateTypeLabel}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
                    {mandateDates(listing.mandateStartDate, listing.mandateEndDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <ListingMetaPanel listing={listing} />
            </div>
          </aside>
        </section>
      </div>
      <GlobalFooter viewerRole={viewerRole} viewerUsername={viewerUsername} />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,15,22,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-7xl gap-2">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {listing.priceQualifier ? (
                <p className="truncate text-[10px] font-black uppercase tracking-wide text-primary">
                  {listing.priceQualifier}
                </p>
              ) : null}
              <p className="truncate text-lg font-black">
                {price}
              </p>
              {showReducedPrice ? (
                <p className="truncate text-xs font-black text-red-600">
                  Reduced from{" "}
                  <span className="text-muted-foreground line-through">
                    {formatPriceCents(Number(listing.previousAskingPriceCents))}
                  </span>
                </p>
              ) : null}
              {listing.buyerIncentive && canUseListingActions ? (
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-primary">
                  {listing.buyerIncentive}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            {canUseListingActions ? purchaseActions : null}
            {listing.isOwner ? editListingAction : null}
          </div>
        </div>
      </div>
    </main>
  );
}
