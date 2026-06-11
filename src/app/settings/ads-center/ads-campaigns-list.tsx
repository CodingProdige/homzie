"use client";

import { useState, useTransition } from "react";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCompactNumber, formatCurrencyFromCents } from "@/modules/ads/forecast";
import { updateAdCampaignStatus } from "./actions";
import type { CampaignSummary } from "./types";

function formatAreaMetric(value: number, unavailableLabel = "Unavailable") {
  if (!value) return unavailableLabel;

  return formatCompactNumber(value);
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
  const campaignLabel = campaign.targetLocation
    ? `${campaign.promotedLabel} - ${campaign.targetLocation}`
    : campaign.promotedLabel;
  const areaSummary =
    campaign.targetScope === "global"
      ? "Global audience"
      : campaign.targetAreaCount && campaign.targetAreaCount > 1
        ? `${campaign.targetAreaCount} selected areas`
        : `${formatAreaMetric(campaign.targetActiveUsersEstimate, "0")} active users`;

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-4 align-top">
        <p className="font-black">{campaignLabel}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {campaign.targetLocationPlaceId ? areaSummary : campaign.promotedLabel}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {campaign.channel === "google" ? "Google" : "Homzie"}
        {campaign.channel === "google" ? (
          <p className="mt-1 text-xs font-semibold capitalize text-muted-foreground">
            {campaign.googleSyncStatus.replaceAll("_", " ")}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {formatCurrencyFromCents(campaign.totalBudgetCents)}
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Delivered {formatCurrencyFromCents(campaign.deliveredSpendCents ?? 0)}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {formatCompactNumber(campaign.estimatedReach)}
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {formatCompactNumber(campaign.estimatedClicks)} est. clicks
        </p>
      </td>
      <td className="px-4 py-4 align-top text-sm font-semibold">
        {formatCurrencyFromCents(campaign.billedSpendCents ?? 0)}
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {formatCurrencyFromCents(campaign.outstandingSpendCents ?? 0)} outstanding
        </p>
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
          {canPause ? "Pause" : canResume ? "Resume" : "Update"}
        </Button>
      </td>
    </tr>
  );
}

export function AdsCampaignsList({
  campaigns,
}: {
  campaigns: CampaignSummary[];
}) {
  const [, startStatusTransition] = useTransition();
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Campaigns</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Published campaigns can be paused and resumed here. Existing spend
              remains billable even when delivery is paused.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {campaigns.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Reach</th>
                <th className="px-4 py-3">Billing</th>
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
            Publish your first campaign to start promoting your profile, listings,
            or reels across the channels you choose.
          </p>
        </div>
      )}
    </section>
  );
}
