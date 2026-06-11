"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Tags,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  runAdminGoogleAdsAutomationSync,
  type AdminGoogleAdsAutomationState,
} from "./actions";
import type { GoogleDsaAutomationHealth } from "@/modules/google-ads/dsa";

const initialState: AdminGoogleAdsAutomationState = {
  health: null,
  message: "",
  ok: false,
};

function SyncButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} variant="outline" className="w-full sm:w-auto">
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Running check..." : "Run sync check"}
    </Button>
  );
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function formatSyncTime(value: Date | string | null) {
  if (!value) {
    return "Not run yet";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function HealthPill({
  icon: Icon,
  tone,
  text,
}: {
  icon: typeof CheckCircle2;
  tone: "danger" | "muted" | "success";
  text: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black capitalize",
        tone === "success" && "border-primary/25 bg-primary/10 text-primary",
        tone === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "muted" && "border-border bg-muted/60 text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}

function toneForSyncStatus(status: string): "danger" | "muted" | "success" {
  if (status === "sync_error") {
    return "danger";
  }

  if (status === "campaign_enabled" || status === "feed_active") {
    return "success";
  }

  return "muted";
}

function latestStateIcon(status: string) {
  if (status === "sync_error") {
    return ShieldAlert;
  }

  if (status === "campaign_paused" || status === "awaiting_manual_pause") {
    return PauseCircle;
  }

  if (status === "campaign_enabled" || status === "feed_active") {
    return PlayCircle;
  }

  return CircleDashed;
}

function renderLatestStateIcon(status: string) {
  const Icon = latestStateIcon(status);
  return <Icon className="size-4" />;
}

export function AdminGoogleAdsHealthCard({
  health: initialHealth,
}: {
  health: GoogleDsaAutomationHealth;
}) {
  const [state, action] = useActionState(runAdminGoogleAdsAutomationSync, initialState);
  const health = state.health ?? initialHealth;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Automation health
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            Google DSA status
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
            Watch the live listing count, the most recent Google sync result, and the exact API failure if the developer token is still waiting on Basic Access approval.
          </p>
        </div>

        <form action={action}>
          <SyncButton />
        </form>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <HealthPill
          icon={health.googlePromotionEnabled ? CheckCircle2 : AlertCircle}
          tone={health.googlePromotionEnabled ? "success" : "danger"}
          text={health.googlePromotionEnabled ? "google promotion on" : "google promotion off"}
        />
        <HealthPill
          icon={health.automationEnabled ? ShieldCheck : ShieldAlert}
          tone={health.automationEnabled ? "success" : "muted"}
          text={health.automationEnabled ? "automation on" : "automation off"}
        />
        <HealthPill
          icon={health.credentialsComplete ? CheckCircle2 : AlertCircle}
          tone={health.credentialsComplete ? "success" : "danger"}
          text={health.credentialsComplete ? "credentials complete" : "credentials incomplete"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Tags className="size-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">
                Active listings
              </p>
              <p className="mt-1 text-3xl font-black">{health.activeGoogleListings}</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
            Published listing URLs that are currently eligible for the Homzie-managed Google feed.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              {renderLatestStateIcon(health.lastSyncStatus)}
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">
                Latest state
              </p>
              <p className="mt-1 text-lg font-black capitalize">
                {statusLabel(health.lastSyncStatus)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
            Last checked {formatSyncTime(health.lastSyncAt)}.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">
                Campaign wiring
              </p>
              <p className="mt-1 text-lg font-black">
                {health.dsaCampaignIdConfigured && health.feedConfigured
                  ? "Ready"
                  : "Needs setup"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
            Feed token {health.feedConfigured ? "saved" : "missing"}, DSA campaign ID{" "}
            {health.dsaCampaignIdConfigured ? "saved" : "missing"}, login customer ID{" "}
            {health.loginCustomerIdConfigured ? "saved" : "optional"}.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <CircleDashed className="size-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">
                Google campaigns
              </p>
              <p className="mt-1 text-3xl font-black">{health.totalGoogleCampaigns}</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
            Total Google listing promotion records Homzie is currently tracking.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div
          className={cn(
            "rounded-lg border p-4",
            health.lastError
              ? "border-destructive/25 bg-destructive/5"
              : "border-border bg-background",
          )}
        >
          <div className="flex items-center gap-2">
            {health.lastError ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : (
              <ShieldCheck className="size-4 text-primary" />
            )}
            <h3 className="text-sm font-black">Latest API result</h3>
          </div>
          <p
            className={cn(
              "mt-3 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]",
              health.lastError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {health.lastError ||
              "No Google Ads API error has been recorded yet. Run a sync check if you want to verify the current credential set manually."}
          </p>
          {state.message ? (
            <p
              className={cn(
                "mt-4 inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold [overflow-wrap:anywhere]",
                state.ok
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-destructive/25 bg-destructive/10 text-destructive",
              )}
            >
              {state.ok ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              {state.message}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <h3 className="text-sm font-black">Access level note</h3>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
            {health.tokenStateLabel}. If Google still reports permission errors, confirm the developer token has moved from Test Account Access to Basic Access in the Google Ads API Center.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center">
        <HealthPill
          icon={latestStateIcon(health.lastSyncStatus)}
          tone={toneForSyncStatus(health.lastSyncStatus)}
          text={statusLabel(health.lastSyncStatus)}
        />
      </div>
    </section>
  );
}
