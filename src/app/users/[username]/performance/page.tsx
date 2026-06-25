import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import {
  BadgeCheck,
  ChartPie,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
  ReceiptText,
  Send,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { PageTopBar } from "@/components/page-top-bar";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { users } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  PerformanceRangeSelector,
} from "@/modules/agents/components/performance-range-selector";
import { PerformanceShareDialog } from "@/modules/agents/components/performance-share-dialog";
import {
  PerformanceTrendChart,
  type PerformanceTrendPoint,
} from "@/modules/agents/components/performance-trend-chart";
import { performanceRanges } from "@/modules/agents/performance-ranges";
import {
  type AgentPerformanceRange,
  getAgentPerformanceStats,
  getAgentSoldPropertyHistory,
} from "@/modules/agents/performance";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername } from "@/modules/auth/username";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import { CurrencySelector } from "@/modules/currency/currency-selector";
import { toPublicMediaUrl } from "@/media/paths";

type AgentPerformanceRouteProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<{
    range?: string;
  }>;
};

async function getPerformanceProfile(usernameParam: string) {
  const username = normalizeUsername(usernameParam);

  if (!username) {
    return null;
  }

  const [profile] = await db
    .select({
      id: users.id,
      avatarUrl: users.avatarUrl,
      name: users.name,
      publicPerformanceVisible: users.publicPerformanceVisible,
      username: users.username,
    })
    .from(users)
    .where(
      and(
        eq(users.username, username),
        eq(users.status, "active"),
        eq(users.profileVisible, true),
      ),
    )
    .limit(1);

  return profile || null;
}

function parseRange(value: string | undefined): AgentPerformanceRange {
  return performanceRanges.some((range) => range.value === value)
    ? (value as AgentPerformanceRange)
    : "year";
}

function isPositiveDelta(value: string) {
  return value.startsWith("+") && value !== "+0" && value !== "+0%";
}

function deltaPill(value: string) {
  if (!value || value === "0" || value === "0%") return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black leading-none text-emerald-600">
      <span className="text-[10px]">{isPositiveDelta(value) ? "▲" : "▼"}</span>
      {value.replace("+", "")}
    </span>
  );
}

function getPercent(value: number, total: number) {
  if (total <= 0) return 0;

  return Math.max(4, Math.round((value / total) * 100));
}

const mobilePerformanceItems = [
  {
    description: "Win rate, sales count, total value, and proof-backed sales.",
    href: "#summary",
    icon: Trophy,
    label: "Summary",
  },
  {
    description: "Completed outcomes split by wins, losses, disputes, and more.",
    href: "#outcomes",
    icon: ChartPie,
    label: "Outcomes",
  },
  {
    description: "Recorded sold value over the selected period.",
    href: "#trend",
    icon: CircleDollarSign,
    label: "Value trend",
  },
  {
    description: "The property sale records behind this performance profile.",
    href: "#sold-properties",
    icon: ReceiptText,
    label: "Sold properties",
  },
  {
    description: "How Homzie protects outcomes from deletion and disputes.",
    href: "#proof",
    icon: ShieldCheck,
    label: "Proof system",
  },
];

function MobilePerformanceMenu() {
  return (
    <section className="mt-6 space-y-3 sm:hidden">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
        Performance tools
      </p>
      <div className="space-y-2.5">
        {mobilePerformanceItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-white p-3 text-left shadow-sm transition-colors hover:border-primary/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{item.label}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <span className="text-lg font-bold text-muted-foreground">›</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function rangeStartDate(range: AgentPerformanceRange) {
  const now = new Date();

  if (range === "all") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 11);
    return new Date(start.getFullYear(), start.getMonth(), 1);
  }

  if (range === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }

  const months = range === "month" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const start = new Date(now);
  start.setMonth(start.getMonth() - months + 1);

  return new Date(start.getFullYear(), start.getMonth(), 1);
}

function buildTrendPoints(
  soldProperties: Array<{
    soldAt: Date | null;
    soldPriceCents: number | null;
  }>,
  range: AgentPerformanceRange,
): PerformanceTrendPoint[] {
  const start = rangeStartDate(range);
  const end = new Date();
  const points: PerformanceTrendPoint[] = [];
  const cursor = new Date(start);
  let cumulativeValue = 0;

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setMonth(bucketEnd.getMonth() + 1);

    cumulativeValue += soldProperties
      .filter((property) => {
        if (!property.soldAt) return false;

        return property.soldAt >= bucketStart && property.soldAt < bucketEnd;
      })
      .reduce((total, property) => total + (property.soldPriceCents || 0), 0);

    points.push({
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(bucketStart),
      valueCents: cumulativeValue,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points.length ? points : [{ label: "Now", valueCents: 0 }];
}

function buildOutcomeGradient(rows: Array<{ color: string; value: number }>) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total <= 0) {
    return "conic-gradient(#e8e9f0 0deg 360deg)";
  }

  let cursor = 0;
  const segments = rows
    .filter((row) => row.value > 0)
    .map((row) => {
      const start = cursor;
      const end = cursor + (row.value / total) * 360;

      cursor = end;

      return `${row.color} ${start}deg ${end}deg`;
    });

  return `conic-gradient(${segments.join(", ")})`;
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function PerformanceAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  const safeAvatarUrl = toPublicMediaUrl(avatarUrl);

  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-1 sm:size-20">
      {safeAvatarUrl ? (
        <Image
          src={safeAvatarUrl}
          alt={name}
          width={80}
          height={80}
          className="size-full rounded-full border-[3px] border-[#fbfbfe] object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full border-[3px] border-[#fbfbfe] bg-brand-midnight text-xl font-black text-white sm:text-2xl">
          {initialsFromName(name) || "H"}
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({
  params,
}: AgentPerformanceRouteProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPerformanceProfile(username);

  if (!profile?.username) {
    return {
      title: "Performance not found | Homzie",
    };
  }

  if (!profile.publicPerformanceVisible) {
    return {
      title: `${profile.name} profile | Homzie`,
      description: `${profile.name} has chosen to keep sales performance private.`,
    };
  }

  return {
    title: `${profile.name} performance | Homzie`,
    description: `View ${profile.name}'s verified Homzie agent performance.`,
  };
}

export default async function AgentPerformancePage({
  params,
  searchParams,
}: AgentPerformanceRouteProps) {
  const { username } = await params;
  const query = searchParams ? await searchParams : {};
  const range = parseRange(query.range);
  const profile = await getPerformanceProfile(username);

  if (!profile?.username) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === profile.id;
  const pageClassName =
    "relative min-h-screen overflow-x-hidden bg-[#fbfbfe] text-brand-black";
  const surfaceClassName = "rounded-lg border border-border bg-white shadow-sm";
  const mutedSurfaceClassName =
    "rounded-lg border border-border bg-muted/35 shadow-sm";

  if (!profile.publicPerformanceVisible && !isOwner) {
    return (
      <main className={pageClassName}>
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-6 pt-20 sm:px-8 sm:pb-8">
          <PageTopBar
            actions={<CurrencySelector />}
            className="fixed inset-x-0 top-0 z-50 mx-auto max-w-3xl px-5 sm:px-8"
          />
          <section className="my-auto rounded-lg border border-border bg-white p-6 text-center shadow-sm sm:p-10">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
              <LockKeyhole className="size-7" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight">
              Performance private
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
              This agent has chosen not to publish sales performance publicly.
              Their listings and profile remain available.
            </p>
            <Button asChild className="mt-6">
              <Link href={`/users/${profile.username}`}>Back to profile</Link>
            </Button>
          </section>
        </div>
      </main>
    );
  }

  const stats = await getAgentPerformanceStats(profile.id, range);
  const soldProperties = await getAgentSoldPropertyHistory(profile.id, range);
  const trendPoints = buildTrendPoints(soldProperties, range);
  const summaryCards = [
    {
      accent: "bg-primary/10 text-primary",
      delta: stats.winRateDeltaLabel,
      description: `${stats.soldCount} won of ${stats.completedMandates} completed mandates`,
      info: "The percentage of completed mandates this agent personally won and sold. Disputed, withdrawn, and expired outcomes are excluded from the win-rate calculation until they are resolved.",
      icon: Trophy,
      label: "Win rate",
      value: stats.winRateLabel,
    },
    {
      accent: "bg-emerald-100 text-emerald-600",
      delta: stats.soldThisYearDeltaLabel,
      description: "Verified and claimed sales in the selected period",
      info: "The number of listings this agent has claimed as sold in the selected date range after the listing moved into a completed sale state.",
      icon: CircleDollarSign,
      label: "Sold this period",
      value: stats.soldThisYearLabel,
    },
    {
      accent: "bg-orange-100 text-orange-500",
      delta: stats.totalSoldValueThisYearDeltaLabel,
      description: "Sales value recorded in the selected period",
      info: "The total recorded sold value for this agent's completed sales in the selected date range. Values are stored in ZAR and converted for display when you change currency.",
      icon: ChartPie,
      isCurrency: true,
      label: "Total value",
      value: stats.totalSoldValueThisYearCents,
    },
    {
      accent: "bg-blue-100 text-blue-600",
      delta: stats.verifiedSalesDeltaLabel,
      description: "Sales with proof confirmation",
      info: "The number of completed sales that have supporting proof confirmed. This keeps the performance record proof-backed instead of purely self-reported.",
      icon: ReceiptText,
      label: "Verified sales",
      value: stats.verifiedSalesLabel,
    },
  ];
  const breakdownRows = [
    {
      barClassName: "bg-emerald-600",
      chartColor: "#16a34a",
      description: "Listings you won and sold",
      info: "Completed mandate outcomes where this agent is recorded as the agent who sold the property.",
      icon: Trophy,
      iconClassName: "bg-emerald-100 text-emerald-600",
      label: "Sold by you",
      value: stats.soldCount,
    },
    {
      barClassName: "bg-orange-500",
      chartColor: "#f97316",
      description: "Listings you lost to another agent",
      info: "Listings connected to this agent where the property was ultimately sold by another agent. These count against the win rate once the outcome is confirmed.",
      icon: Clock3,
      iconClassName: "bg-orange-100 text-orange-500",
      label: "Sold by another agent",
      value: stats.soldExternallyCount,
    },
    {
      barClassName: "bg-primary",
      chartColor: "#6335ff",
      description: "Outcomes under review",
      info: "Listings with conflicting or incomplete sale outcomes. They stay separate until proof confirms which agent should receive the outcome.",
      icon: ShieldCheck,
      iconClassName: "bg-primary/10 text-primary",
      label: "Pending disputes",
      value: stats.disputedCount,
    },
    {
      barClassName: "bg-slate-300",
      chartColor: "#cbd5e1",
      description: "Mandates withdrawn",
      info: "Listings that were removed from sale before a completed outcome. They are tracked for history but do not count as wins.",
      icon: ReceiptText,
      iconClassName: "bg-slate-100 text-slate-500",
      label: "Withdrawn mandates",
      value: stats.withdrawnCount,
    },
    {
      barClassName: "bg-slate-300",
      chartColor: "#e2e8f0",
      description: "Mandates that expired",
      info: "Listings where the mandate period ended without a completed sale. They are tracked as outcomes but are separated from confirmed sales.",
      icon: ReceiptText,
      iconClassName: "bg-slate-100 text-slate-500",
      label: "Expired mandates",
      value: stats.expiredCount,
    },
  ];
  const totalOutcomes = breakdownRows.reduce((total, row) => total + row.value, 0);
  const outcomeGradient = buildOutcomeGradient(
    breakdownRows.map((row) => ({
      color: row.chartColor,
      value: row.value,
    })),
  );

  return (
    <main className={pageClassName}>
      <div className="relative z-10 mx-auto w-full max-w-[1160px] px-5 pb-6 pt-20 sm:px-8 sm:pb-9">
        <PageTopBar className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[1160px] px-5 sm:px-8" />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 sm:hidden">
          <PerformanceRangeSelector
            currentRange={range}
            username={profile.username}
          />
          <CurrencySelector />
        </div>

        <div className="mt-5 hidden items-center justify-end gap-3 sm:flex">
          <PerformanceRangeSelector
            currentRange={range}
            username={profile.username}
          />
          <CurrencySelector />
        </div>

        <section className="mt-7 grid justify-items-center gap-y-4 text-center sm:mt-8 sm:grid-cols-[5rem_minmax(0,1fr)] sm:justify-items-start sm:gap-x-4 sm:gap-y-5 sm:text-left">
          <div className="sm:col-start-1 sm:row-start-1">
            <PerformanceAvatar avatarUrl={profile.avatarUrl} name={profile.name} />
          </div>
          <div className="min-w-0 sm:col-start-2">
            <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
              <h1 className="min-w-0 text-2xl font-black leading-tight tracking-tight sm:truncate sm:text-3xl">
                <span className="sm:hidden">{profile.name}</span>
                <span className="hidden sm:inline">{profile.name} performance</span>
              </h1>
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20">
                <BadgeCheck className="size-3.5" />
              </span>
            </div>
            <Link
              href={`/users/${profile.username}`}
              className="mt-1 inline-flex max-w-full justify-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary sm:justify-start"
            >
              <span className="truncate">@{profile.username}</span>
            </Link>
            <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-5 text-muted-foreground sm:mx-0 sm:max-w-2xl sm:leading-6">
              A verified view of sales outcomes, mandate history, and proof-backed
              performance for this Homzie Agent profile.
            </p>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-2 sm:col-start-2 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:gap-3">
            <Button asChild variant="outline" className="min-w-0">
              <Link href={`/users/${profile.username}`}>View profile</Link>
            </Button>
            <PerformanceShareDialog
              username={profile.username || username}
              name={profile.name}
              isOwner={isOwner}
            />
          </div>
        </section>

        <MobilePerformanceMenu />

        <section id="summary" className="mt-8 scroll-mt-24 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className={cn(surfaceClassName, "p-4 sm:p-5 lg:min-h-[150px]")}
              >
                <div className="flex items-center gap-3 lg:block">
                  <div className={cn("grid size-10 shrink-0 place-items-center rounded-full", card.accent)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 lg:mt-5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground lg:text-[11px]">
                        {card.label}
                      </p>
                      <AnalyticsInfoPopover
                        title={card.label}
                        description={card.info}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 break-words font-black leading-tight tracking-tight",
                          card.isCurrency
                            ? "text-[1.35rem] sm:text-2xl xl:text-[1.65rem]"
                            : "text-xl sm:text-2xl lg:text-3xl",
                        )}
                      >
                        {card.isCurrency ? (
                          <CurrencyAmount cents={card.value as number} />
                        ) : (
                          card.value
                        )}
                      </p>
                      {deltaPill(card.delta)}
                    </div>
                    <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground lg:mt-2">
                      {card.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <article id="outcomes" className={cn(surfaceClassName, "scroll-mt-24 p-5 sm:p-6")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black">Performance overview</h2>
                  <AnalyticsInfoPopover
                    title="Performance overview"
                    description="A proof-aware summary of every listing outcome attached to this agent. Confirmed wins, losses, disputes, withdrawn mandates, and expired mandates are separated so the totals cannot be inflated by deleting or hiding listings."
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-muted-foreground">
                  Outcome counts are locked from completed mandate events.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem] md:items-center">
              <div className="space-y-4">
                {breakdownRows.map((row) => {
                  const Icon = row.icon;
                  const width = getPercent(row.value, totalOutcomes);

                  return (
                    <div
                      key={row.label}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-3"
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-full",
                          row.iconClassName,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate text-sm font-black">
                                {row.label}
                              </p>
                              <AnalyticsInfoPopover
                                title={row.label}
                                description={row.info}
                              />
                            </div>
                            <p className="truncate text-xs font-semibold text-muted-foreground">
                              {row.description}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full", row.barClassName)}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-right text-sm font-black">{row.value}</span>
                    </div>
                  );
                })}
              </div>

              <div
                className="mx-auto grid size-52 place-items-center rounded-full p-6 shadow-sm"
                style={{ background: outcomeGradient }}
              >
                <div className="grid size-full place-items-center rounded-full bg-white text-center">
                  <p className="text-4xl font-black">{stats.completedMandates}</p>
                  <p className="mt-1 max-w-[7rem] text-xs font-black leading-4 text-muted-foreground">
                    Total completed mandates
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article id="trend" className="relative scroll-mt-24 overflow-hidden rounded-lg bg-[#101225] p-5 text-white shadow-sm sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_35%,rgba(255,77,184,0.28),transparent_28%),linear-gradient(145deg,rgba(124,92,255,0.16),transparent_45%)]" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black">Total value trend</h2>
                  <AnalyticsInfoPopover
                    title="Total value trend"
                    description="A month-by-month view of this agent's recorded sold value in the selected date range. The line uses confirmed sold property values and stays currency-aware for display."
                  />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-black tracking-tight">
                    <CurrencyAmount cents={stats.totalSoldValueThisYearCents} />
                  </p>
                  {deltaPill(stats.totalSoldValueThisYearDeltaLabel)}
                </div>
                <p className="mt-2 text-sm font-semibold text-white/75">
                  Total value in selected period
                </p>
              </div>
              <PerformanceRangeSelector
                currentRange={range}
                username={profile.username}
              />
            </div>

            <PerformanceTrendChart points={trendPoints} />
          </article>
        </section>

        <section id="sold-properties" className={cn(surfaceClassName, "mt-4 scroll-mt-24 p-5 sm:p-6")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black">Previous properties sold</h2>
                <AnalyticsInfoPopover
                  title="Previous properties sold"
                  description="A record of properties this agent sold in the selected period, including asking price, final sold price, days on market, and proof status."
                />
              </div>
              <p className="mt-2 text-xs font-bold text-muted-foreground">
                Listing price compared to final sale price and time on market.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
              {soldProperties.length} sold
            </span>
          </div>

          {soldProperties.length ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-border bg-muted/35 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-muted-foreground md:grid">
                <span>Property</span>
                <span>Listed for</span>
                <span>Sold for</span>
                <span>On market</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-border">
                {soldProperties.map((property) => (
                  <div
                    key={property.id}
                    className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_0.8fr_0.8fr] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{property.title}</p>
                      {property.location ? (
                        <p className="mt-1 truncate text-xs font-bold text-muted-foreground">
                          {property.location}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground md:hidden">
                        Listed for
                      </p>
                      <p className="mt-1 text-sm font-black md:mt-0">
                        {property.askingPriceCents ? (
                          <CurrencyAmount cents={property.askingPriceCents} />
                        ) : (
                          "Not captured"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground md:hidden">
                        Sold for
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-600 md:mt-0">
                        {property.soldPriceCents ? (
                          <CurrencyAmount cents={property.soldPriceCents} />
                        ) : (
                          "Not captured"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground md:hidden">
                        On market
                      </p>
                      <p className="mt-1 text-sm font-black md:mt-0">
                        {property.daysOnMarketLabel}
                      </p>
                    </div>
                    <div>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                          property.proofStatus === "verified"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {property.proofStatus === "verified"
                          ? "Verified"
                          : property.proofStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={cn(mutedSurfaceClassName, "mt-5 px-5 py-8 text-center")}
            >
              <ReceiptText className="mx-auto size-9 text-muted-foreground" />
              <h3 className="mt-3 text-base font-black">No sold properties yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
                Sold listings will appear here once this agent records completed
                sales in the selected date range.
              </p>
            </div>
          )}
        </section>

        <section id="proof" className="mt-4 scroll-mt-24 overflow-hidden rounded-lg [background:var(--homzie-gradient)] p-4 text-white shadow-sm sm:p-8">
          <div className="grid gap-4 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center md:gap-6">
            <div className="grid size-14 place-items-center rounded-2xl bg-white/10 shadow-inner sm:size-20 md:size-28 md:rounded-3xl">
              <ShieldCheck className="size-8 drop-shadow sm:size-11 md:size-16" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black leading-tight sm:text-2xl">
                  Proof-backed reputation
                </h2>
                <AnalyticsInfoPopover
                  title="Proof-backed reputation"
                  description="Homzie separates disputed and unverified sales until proof confirms the correct outcome, so agent performance can act as a trustworthy sales record."
                />
              </div>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/90 sm:mt-3 sm:text-sm sm:leading-7">
                Sold listings are counted after status changes and proof checks.
                Disputed property outcomes are separated until proof confirms the
                correct agent.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-black leading-5 text-white/90 sm:gap-3 sm:text-sm">
              <Send className="size-4 sm:size-5" />
              Trusted by buyers, sellers and other agents
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
