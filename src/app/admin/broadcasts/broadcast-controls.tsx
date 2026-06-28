"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  duplicateBroadcastCampaignAction,
  type BroadcastActionState,
  scheduleBroadcastCampaignAction,
  sendBroadcastCampaignAction,
} from "./actions";

type BroadcastControlsProps = {
  campaignId: string;
  progress?: {
    failedCount: number;
    pendingCount: number;
    processedCount: number;
    processingCount: number;
    sentCount: number;
    totalCount: number;
  };
  status: string;
};

const emptyBroadcastActionState: BroadcastActionState = {
  message: "",
  ok: false,
};

function ActionMessage({
  message,
  ok,
}: {
  message: string;
  ok: boolean;
}) {
  if (!message) return null;

  return (
    <p
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold",
        ok
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {message}
    </p>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("en-ZA");
}

export function BroadcastControls({
  campaignId,
  progress,
  status,
}: BroadcastControlsProps) {
  const router = useRouter();
  const [sendState, sendAction, sending] = useActionState(
    sendBroadcastCampaignAction,
    emptyBroadcastActionState,
  );
  const [scheduleState, scheduleAction, scheduling] = useActionState(
    scheduleBroadcastCampaignAction,
    emptyBroadcastActionState,
  );
  const canSend = status === "draft" || status === "failed" || status === "scheduled";
  const canSchedule = status === "draft" || status === "failed" || status === "scheduled";
  const totalCount = progress?.totalCount || 0;
  const processedCount = progress?.processedCount || 0;
  const percent =
    totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;
  const showProgress = status === "sending" || totalCount > 0;

  useEffect(() => {
    if (sendState.ok || scheduleState.ok) {
      router.refresh();
    }
  }, [router, scheduleState.ok, sendState.ok]);

  useEffect(() => {
    if (status !== "sending") return;

    const interval = window.setInterval(() => router.refresh(), 3000);

    return () => window.clearInterval(interval);
  }, [router, status]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Delivery
          </p>
          <h2 className="mt-1 text-lg font-semibold">Send controls</h2>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
          {status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <form action={sendAction}>
          <input name="campaignId" type="hidden" value={campaignId} />
          <Button disabled={!canSend || sending} type="submit">
            <Send className="size-4" />
            {sending ? "Queueing" : status === "sending" ? "Sending" : "Send now"}
          </Button>
        </form>

        <form action={scheduleAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input name="campaignId" type="hidden" value={campaignId} />
          <Input
            aria-label="Schedule date and time"
            disabled={!canSchedule || scheduling}
            name="scheduledAt"
            type="datetime-local"
          />
          <Button disabled={!canSchedule || scheduling} type="submit" variant="outline">
            <CalendarClock className="size-4" />
            Schedule
          </Button>
        </form>

        <form action={duplicateBroadcastCampaignAction}>
          <input name="campaignId" type="hidden" value={campaignId} />
          <Button type="submit" variant="outline">
            <Copy className="size-4" />
            Duplicate
          </Button>
        </form>
      </div>

      {showProgress ? (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                {status === "sending" ? "Sending in batches" : "Send progress"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCount(processedCount)} of {formatCount(totalCount)} recipients
                processed
              </p>
            </div>
            <span className="text-sm font-bold text-primary">{percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <span className="rounded-md bg-muted px-3 py-2 font-semibold">
              Pending {formatCount(progress?.pendingCount || 0)}
            </span>
            <span className="rounded-md bg-muted px-3 py-2 font-semibold">
              Processing {formatCount(progress?.processingCount || 0)}
            </span>
            <span className="rounded-md bg-green-100 px-3 py-2 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Accepted {formatCount(progress?.sentCount || 0)}
            </span>
            <span className="rounded-md bg-destructive/10 px-3 py-2 font-semibold text-destructive">
              Failed {formatCount(progress?.failedCount || 0)}
            </span>
          </div>
        </div>
      ) : null}

      <ActionMessage message={sendState.message} ok={sendState.ok} />
      <ActionMessage message={scheduleState.message} ok={scheduleState.ok} />
    </div>
  );
}
