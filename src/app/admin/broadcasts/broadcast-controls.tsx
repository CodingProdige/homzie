"use client";

import { useActionState } from "react";
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

export function BroadcastControls({ campaignId, status }: BroadcastControlsProps) {
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
            {sending ? "Sending" : "Send now"}
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

      <ActionMessage message={sendState.message} ok={sendState.ok} />
      <ActionMessage message={scheduleState.message} ok={scheduleState.ok} />
    </div>
  );
}
