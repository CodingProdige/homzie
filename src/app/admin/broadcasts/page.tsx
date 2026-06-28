import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { CalendarClock, ChevronRight, MailPlus, Megaphone } from "lucide-react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { broadcastCampaigns } from "@/db/schema";

import { createBlankBroadcastCampaignAction } from "./actions";

export const metadata: Metadata = {
  title: "Broadcasts | Homzie Admin",
  description: "Create and track Homzie email broadcasts.",
};

function formatDate(value: Date | null) {
  if (!value) return "Not sent";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return "0%";

  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function AdminBroadcastsPage() {
  const campaigns = await db
    .select()
    .from(broadcastCampaigns)
    .orderBy(desc(broadcastCampaigns.createdAt))
    .limit(50);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin" label="Dashboard" className="mb-6" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Broadcasts
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
            Build campaign emails, target opted-in users, send tests, schedule
            delivery, and review SendGrid engagement events.
          </p>
        </div>
        <form action={createBlankBroadcastCampaignAction}>
          <Button type="submit">
            <MailPlus className="size-4" />
            New broadcast
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-3">
        {campaigns.length ? (
          campaigns.map((campaign) => (
            <Link
              className="group rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
              href={`/admin/broadcasts/${campaign.id}`}
              key={campaign.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">
                      {campaign.status}
                    </span>
                    {campaign.scheduledAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        <CalendarClock className="size-3" />
                        {formatDate(campaign.scheduledAt)}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 truncate text-lg font-semibold">
                    {campaign.name}
                  </h2>
                  <p className="mt-1 truncate text-sm font-normal text-muted-foreground">
                    {campaign.subject}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:w-[30rem]">
                  <span>
                    <span className="block text-xs uppercase text-muted-foreground">
                      Recipients
                    </span>
                    <span className="font-semibold">{campaign.recipientCount}</span>
                  </span>
                  <span>
                    <span className="block text-xs uppercase text-muted-foreground">
                      Delivered
                    </span>
                    <span className="font-semibold">
                      {rate(campaign.deliveredCount, campaign.sentCount)}
                    </span>
                  </span>
                  <span>
                    <span className="block text-xs uppercase text-muted-foreground">
                      Opens
                    </span>
                    <span className="font-semibold">
                      {rate(campaign.openedCount, campaign.deliveredCount)}
                    </span>
                  </span>
                  <span>
                    <span className="block text-xs uppercase text-muted-foreground">
                      Sent
                    </span>
                    <span className="font-semibold">{formatDate(campaign.sentAt)}</span>
                  </span>
                </div>

                <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 lg:block" />
              </div>
            </Link>
          ))
        ) : (
          <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Megaphone className="size-6" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">No broadcasts yet</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Create your first campaign draft to send platform updates,
                agent announcements, or product launches.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
