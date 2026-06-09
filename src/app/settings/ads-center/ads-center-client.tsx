"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  Globe2,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Save,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  averageDailyBudget,
  buildAdForecast,
  formatCompactNumber,
  formatCurrencyFromCents,
} from "@/modules/ads/forecast";
import {
  adObjectives,
  getPrimaryOutcomeLabel,
  type AdChannel,
  type AdObjective,
  type AdPromotedType,
  type AdsSettings,
} from "@/modules/ads/shared";
import { SettingsPageHeader } from "../settings-page-header";
import {
  createAdCampaign,
  emptyCreateAdCampaignState,
  updateAdCampaignStatus,
} from "./actions";

type AssetOption = {
  id: string;
  label: string;
};

type CampaignSummary = {
  channel: string;
  createdAtLabel: string;
  durationDays: number;
  estimatedClicks: number;
  estimatedReach: number;
  estimatedResults: number;
  googleSyncStatus: string;
  id: string;
  name: string;
  objective: string;
  promotedLabel: string;
  status: string;
  totalBudgetCents: number;
};

function ForecastCard({
  active,
  channel,
  forecast,
  outcomeLabel,
}: {
  active: boolean;
  channel: AdChannel;
  forecast: ReturnType<typeof buildAdForecast>;
  outcomeLabel: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm transition-colors",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            {channel === "google" ? (
              <Globe2 className="size-4" />
            ) : (
              <Megaphone className="size-4" />
            )}
          </span>
          <div>
            <p className="text-sm font-black">
              {channel === "google" ? "Google reach" : "Homzie reach"}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              Based on current budget and duration.
            </p>
          </div>
        </div>
        {active ? (
          <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black uppercase text-primary-foreground">
            Selected
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Estimated reach" value={formatCompactNumber(forecast.estimatedReach)} />
        <Metric label="Estimated clicks" value={formatCompactNumber(forecast.estimatedClicks)} />
        <Metric
          label={outcomeLabel}
          value={formatCompactNumber(forecast.estimatedResults)}
        />
        <Metric
          label="Media spend"
          value={formatCurrencyFromCents(forecast.netMediaBudgetCents)}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function CampaignRow({
  campaign,
  onStatusChange,
  pendingId,
}: {
  campaign: CampaignSummary;
  onStatusChange: (campaignId: string, nextStatus: "ready" | "paused") => void;
  pendingId: string | null;
}) {
  const canPause = campaign.status === "ready";
  const canResume = campaign.status === "paused" || campaign.status === "draft";
  const nextStatus = canPause ? "paused" : "ready";
  const buttonLabel = canPause ? "Pause" : canResume ? "Mark ready" : null;

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-4 align-top">
        <p className="font-black">{campaign.name}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {campaign.promotedLabel}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {campaign.channel === "google" ? "Google" : "Homzie"}
        {campaign.channel === "google" ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {campaign.googleSyncStatus.replaceAll("_", " ")}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold capitalize">
        {campaign.objective.replaceAll("_", " ")}
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {formatCurrencyFromCents(campaign.totalBudgetCents)}
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {formatCompactNumber(campaign.estimatedReach)}
      </td>
      <td className="px-4 py-4 align-top">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
            campaign.status === "ready"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : campaign.status === "paused"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                : "bg-primary/10 text-primary",
          )}
        >
          {campaign.status}
        </span>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {campaign.createdAtLabel}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-right">
        {buttonLabel ? (
          <Button
            type="button"
            variant="outline"
            className={cn(
              canPause &&
                "border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive",
            )}
            disabled={pendingId === campaign.id}
            onClick={() => onStatusChange(campaign.id, nextStatus)}
          >
            {pendingId === campaign.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : canPause ? (
              <PauseCircle className="size-4" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            {buttonLabel}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function AdsCenterClient({
  campaigns,
  listingOptions,
  reelOptions,
  settings,
  userLocation,
}: {
  campaigns: CampaignSummary[];
  listingOptions: AssetOption[];
  reelOptions: AssetOption[];
  settings: AdsSettings;
  userLocation: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAdCampaign,
    emptyCreateAdCampaignState,
  );
  const [, startStatusTransition] = useTransition();
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const hasGoogleListingInventory = settings.allowGoogleAds && listingOptions.length > 0;
  const defaultChannel: AdChannel = settings.allowHomzieAds
    ? "homzie"
    : hasGoogleListingInventory
      ? "google"
      : "homzie";

  const [channel, setChannel] = useState<AdChannel>(defaultChannel);
  const [promotedType, setPromotedType] = useState<AdPromotedType>("profile");
  const [objective, setObjective] = useState<AdObjective>("awareness");
  const [durationDays, setDurationDays] = useState(14);
  const [budgetRands, setBudgetRands] = useState(
    Math.round(settings.minCampaignBudgetCents / 100),
  );
  const minBudgetRands = Math.round(settings.minCampaignBudgetCents / 100);
  const maxBudgetRands = Math.round(settings.maxCampaignBudgetCents / 100);
  const effectiveChannel: AdChannel =
    channel === "google" && !hasGoogleListingInventory && settings.allowHomzieAds
      ? "homzie"
      : channel;
  const effectivePromotedType: AdPromotedType =
    effectiveChannel === "google" ? "listing" : promotedType;

  const homzieForecast = useMemo(
    () =>
      buildAdForecast({
        channel: "homzie",
        durationDays,
        objective,
        promotedType: effectivePromotedType,
        settings,
        totalBudgetCents: budgetRands * 100,
      }),
    [budgetRands, durationDays, effectivePromotedType, objective, settings],
  );

  const googleForecast = useMemo(
    () =>
      buildAdForecast({
        channel: "google",
        durationDays,
        objective,
        promotedType: effectivePromotedType,
        settings,
        totalBudgetCents: budgetRands * 100,
      }),
    [budgetRands, durationDays, effectivePromotedType, objective, settings],
  );

  const selectedForecast =
    effectiveChannel === "google" ? googleForecast : homzieForecast;
  const outcomeLabel = getPrimaryOutcomeLabel(effectivePromotedType, objective);

  return (
    <div className="pb-10">
      <form action={formAction}>
        <SettingsPageHeader
          title="Ads Center"
          message={state.message}
          messageTone={state.ok ? "success" : state.message ? "error" : "neutral"}
          actions={
            <Button type="submit" disabled={isPending} className="h-11 px-5 text-sm">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isPending ? "Saving..." : "Save campaign"}
            </Button>
          }
        />

        <div className="grid gap-5 py-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
          <section className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-lg font-bold">Campaign details</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                  Choose what you want to promote, where it should run, and how much you want to spend.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="name">Campaign name</Label>
                  <Input id="name" name="name" placeholder="Winter seller push" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="channel">Channel</Label>
                  <select
                    id="channel"
                    name="channel"
                    value={effectiveChannel}
                    onChange={(event) => {
                      const nextChannel = event.currentTarget.value as AdChannel;
                      setChannel(
                        nextChannel === "google" && !hasGoogleListingInventory
                          ? defaultChannel
                          : nextChannel,
                      );
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {settings.allowHomzieAds ? <option value="homzie">Homzie app</option> : null}
                    {settings.allowGoogleAds ? (
                      <option value="google" disabled={!hasGoogleListingInventory}>
                        Google
                      </option>
                    ) : null}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="promotedType">Promote</Label>
                  <select
                    id="promotedType"
                    name="promotedType"
                    value={effectivePromotedType}
                    onChange={(event) =>
                      setPromotedType(
                        effectiveChannel === "google"
                          ? "listing"
                          : (event.currentTarget.value as AdPromotedType),
                      )
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="profile" disabled={effectiveChannel === "google"}>
                      My profile
                    </option>
                    <option value="listing" disabled={!listingOptions.length}>
                      Listing
                    </option>
                    <option
                      value="reel"
                      disabled={!reelOptions.length || effectiveChannel === "google"}
                    >
                      Reel
                    </option>
                  </select>
                </div>

                {effectiveChannel === "google" ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-foreground md:col-span-2">
                    Google promotion uses Homzie&apos;s shared Dynamic Search Ads campaign. Only published listing pages are added to the protected page feed, then Google decides when those pages are eligible for relevant searches.
                  </div>
                ) : null}

                {effectivePromotedType === "listing" ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="listingId">Listing</Label>
                    <select
                      id="listingId"
                      name="listingId"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      defaultValue={listingOptions[0]?.id || ""}
                    >
                      {listingOptions.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {listing.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {effectivePromotedType === "reel" ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="reelId">Reel</Label>
                    <select
                      id="reelId"
                      name="reelId"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      defaultValue={reelOptions[0]?.id || ""}
                    >
                      {reelOptions.map((reel) => (
                        <option key={reel.id} value={reel.id}>
                          {reel.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="objective">Objective</Label>
                  <select
                    id="objective"
                    name="objective"
                    value={objective}
                    onChange={(event) =>
                      setObjective(event.currentTarget.value as AdObjective)
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {adObjectives.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="targetLocation">Target area</Label>
                  <Input
                    id="targetLocation"
                    name="targetLocation"
                    defaultValue={userLocation}
                    placeholder="Cape Town, Paarl, Stellenbosch"
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    name="headline"
                    placeholder="Trusted local agent for Paarl and Stellenbosch"
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="copy">Campaign copy</Label>
                  <textarea
                    id="copy"
                    name="copy"
                    rows={4}
                    placeholder="Helping sellers move with confidence through standout listings, reels and hands-on support."
                    className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Budget and duration</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Increase spend to expand reach across Homzie and Google.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-right">
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
                    Daily budget
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatCurrencyFromCents(
                      averageDailyBudget(budgetRands * 100, durationDays),
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-6">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="totalBudgetRands">Total budget</Label>
                    <span className="text-sm font-black text-primary">
                      {formatCurrencyFromCents(budgetRands * 100)}
                    </span>
                  </div>
                  <input
                    id="budgetRange"
                    type="range"
                    min={minBudgetRands}
                    max={maxBudgetRands}
                    step="50"
                    value={budgetRands}
                    onChange={(event) =>
                      setBudgetRands(
                        clamp(Number(event.currentTarget.value), minBudgetRands, maxBudgetRands),
                      )
                    }
                    className="reel-progress-slider"
                  />
                  <Input
                    id="totalBudgetRands"
                    name="totalBudgetRands"
                    type="number"
                    min={minBudgetRands}
                    max={maxBudgetRands}
                    step="50"
                    value={budgetRands}
                    onChange={(event) =>
                      setBudgetRands(
                        clamp(Number(event.currentTarget.value), minBudgetRands, maxBudgetRands),
                      )
                    }
                  />
                  <p className="text-xs font-semibold text-muted-foreground">
                    Budgets from {formatCurrencyFromCents(settings.minCampaignBudgetCents)} to{" "}
                    {formatCurrencyFromCents(settings.maxCampaignBudgetCents)}.
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="durationDays">Duration</Label>
                    <span className="text-sm font-black text-primary">{durationDays} days</span>
                  </div>
                  <input
                    id="durationRange"
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={durationDays}
                    onChange={(event) =>
                      setDurationDays(clamp(Number(event.currentTarget.value), 3, 60))
                    }
                    className="reel-progress-slider"
                  />
                  <Input
                    id="durationDays"
                    name="durationDays"
                    type="number"
                    min="3"
                    max="60"
                    step="1"
                    value={durationDays}
                    onChange={(event) =>
                      setDurationDays(clamp(Number(event.currentTarget.value), 3, 60))
                    }
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
                  <input
                    type="checkbox"
                    name="launchNow"
                    className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold leading-6 text-foreground">
                    Mark this campaign ready immediately instead of saving it as a draft.
                  </span>
                </label>
              </div>
            </section>
          </section>

          <section className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <BarChart3 className="size-4" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Potential reach</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Forecasts update as you change budget, channel and duration.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <ForecastCard
                  active={channel === "homzie"}
                  channel="homzie"
                  forecast={homzieForecast}
                  outcomeLabel={outcomeLabel}
                />
                <ForecastCard
                  active={channel === "google"}
                  channel="google"
                  forecast={googleForecast}
                  outcomeLabel={outcomeLabel}
                />
              </div>

              <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-black text-foreground">Selected channel summary</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Estimated impressions"
                    value={formatCompactNumber(selectedForecast.estimatedImpressions)}
                  />
                  <Metric
                    label="Estimated clicks"
                    value={formatCompactNumber(selectedForecast.estimatedClicks)}
                  />
                  <Metric label={outcomeLabel} value={formatCompactNumber(selectedForecast.estimatedResults)} />
                  <Metric
                    label="Media budget after fees"
                    value={formatCurrencyFromCents(selectedForecast.netMediaBudgetCents)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Target className="size-4" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Good to know</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Forecasts are estimates based on recent campaign assumptions, available inventory, and your selected targeting. Google campaigns are planned here first, with delivery connections able to come next.
                  </p>
                </div>
              </div>
            </section>
          </section>
        </div>
      </form>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Campaigns</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                Saved drafts and launched campaigns for your profile, listings and reels.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold">
              {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {campaigns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Objective</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Reach</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    pendingId={pendingCampaignId}
                    onStatusChange={(campaignId, nextStatus) => {
                      setPendingCampaignId(campaignId);
                      startStatusTransition(async () => {
                        try {
                          await updateAdCampaignStatus(campaignId, nextStatus);
                        } finally {
                          setPendingCampaignId(null);
                        }
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-black">No campaigns yet</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Create your first campaign to start planning promotion for your profile, listings or reels.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
