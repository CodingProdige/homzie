import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { BackButton } from "@/components/back-button";
import { db } from "@/db";
import {
  broadcastCampaignEvents,
  broadcastCampaignRecipients,
  broadcastCampaigns,
} from "@/db/schema";
import {
  getBroadcastSendProgress,
  normalizeBroadcastAudience,
  normalizeBroadcastBlocks,
} from "@/modules/broadcasts/server";

import { BroadcastComposer } from "../broadcast-composer";
import { BroadcastControls } from "../broadcast-controls";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export const metadata: Metadata = {
  title: "Broadcast Details | Homzie Admin",
  description: "Manage and review a Homzie broadcast campaign.",
};

function formatDate(value: Date | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return "0%";

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function sendGridWebhookUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://homzie.co.za";

  return `${baseUrl.replace(/\/$/, "")}/api/sendgrid/events`;
}

function metricCards(campaign: typeof broadcastCampaigns.$inferSelect) {
  return [
    { label: "Recipients", value: campaign.recipientCount.toLocaleString("en-ZA") },
    { label: "Accepted", value: campaign.sentCount.toLocaleString("en-ZA") },
    {
      label: "Delivered",
      value: `${campaign.deliveredCount.toLocaleString("en-ZA")} (${rate(
        campaign.deliveredCount,
        campaign.sentCount,
      )})`,
    },
    {
      label: "Opened",
      value: `${campaign.openedCount.toLocaleString("en-ZA")} (${rate(
        campaign.openedCount,
        campaign.deliveredCount,
      )})`,
    },
    {
      label: "Machine opens",
      value: campaign.machineOpenCount.toLocaleString("en-ZA"),
    },
    {
      label: "Clicked",
      value: `${campaign.clickedCount.toLocaleString("en-ZA")} (${rate(
        campaign.clickedCount,
        campaign.openedCount,
      )})`,
    },
    { label: "Bounced", value: campaign.bouncedCount.toLocaleString("en-ZA") },
    { label: "Dropped", value: campaign.droppedCount.toLocaleString("en-ZA") },
    {
      label: "Unsubscribed",
      value: campaign.unsubscribedCount.toLocaleString("en-ZA"),
    },
  ];
}

export default async function AdminBroadcastDetailsPage({ params }: PageProps) {
  const { campaignId } = await params;
  const [campaign] = await db
    .select()
    .from(broadcastCampaigns)
    .where(eq(broadcastCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    notFound();
  }

  const [recipients, events, progress] = await Promise.all([
    db
      .select()
      .from(broadcastCampaignRecipients)
      .where(eq(broadcastCampaignRecipients.campaignId, campaign.id))
      .orderBy(desc(broadcastCampaignRecipients.createdAt))
      .limit(50),
    db
      .select()
      .from(broadcastCampaignEvents)
      .where(eq(broadcastCampaignEvents.campaignId, campaign.id))
      .orderBy(desc(broadcastCampaignEvents.occurredAt))
      .limit(50),
    getBroadcastSendProgress(campaign.id),
  ]);

  const audience = normalizeBroadcastAudience(campaign.audience);
  const blocks = normalizeBroadcastBlocks(campaign.blocks);
  const metrics = metricCards(campaign);
  const eventWebhookSecretConfigured = Boolean(process.env.SENDGRID_EVENT_WEBHOOK_SECRET);
  const showSendGridEventNotice =
    campaign.sentCount > 0 && (campaign.deliveredCount === 0 || events.length === 0);
  const webhookUrl = sendGridWebhookUrl();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/broadcasts" label="Broadcasts" className="mb-6" />

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Broadcasts
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {campaign.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
            {campaign.subject}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Last updated
          </span>
          <span className="mt-1 block font-semibold">
            {formatDate(campaign.updatedAt)}
          </span>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={metric.label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      {showSendGridEventNotice ? (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            Waiting for SendGrid delivery events
          </p>
          <p className="mt-2 leading-6 text-amber-900/90 dark:text-amber-100/80">
            Accepted means SendGrid accepted Homzie&apos;s send request. Delivered,
            opened, clicked, bounced, dropped and unsubscribed only update after
            SendGrid posts Event Webhook data back to Homzie.
          </p>
          <div className="mt-3 rounded-md bg-white/70 p-3 text-amber-950 dark:bg-black/20 dark:text-amber-100">
            <p className="font-semibold">Webhook URL</p>
            <code className="mt-1 block break-all text-xs">
              {webhookUrl}
              {eventWebhookSecretConfigured
                ? "?secret=<SENDGRID_EVENT_WEBHOOK_SECRET>"
                : ""}
            </code>
          </div>
          {!eventWebhookSecretConfigured ? (
            <p className="mt-3 rounded-md bg-destructive/10 p-3 font-semibold text-destructive">
              SENDGRID_EVENT_WEBHOOK_SECRET is not configured. In production,
              Homzie rejects SendGrid event callbacks until this env value is set.
            </p>
          ) : null}
          <p className="mt-3 leading-6 text-amber-900/90 dark:text-amber-100/80">
            In SendGrid, enable the Event Webhook for processed, delivered, open,
            click, bounce, dropped, spam report and unsubscribe events. Open and
            click metrics also require SendGrid tracking to be enabled.
          </p>
        </section>
      ) : null}

      <div className="mb-6">
        <BroadcastControls
          campaignId={campaign.id}
          progress={progress}
          status={campaign.status}
        />
      </div>

      <BroadcastComposer
        campaignId={campaign.id}
        initialAudience={audience}
        initialAudienceCount={campaign.lastAudienceCount}
        initialBlocks={blocks}
        initialName={campaign.name}
        initialPreheader={campaign.preheader}
        initialStatus={campaign.status}
        initialSubject={campaign.subject}
      />

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Recipients
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              Latest campaign recipients
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing latest {recipients.length} rows
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Recipient</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Sent</th>
                <th className="py-3 pr-4 font-semibold">Opened</th>
                <th className="py-3 pr-4 font-semibold">Clicked</th>
                <th className="py-3 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="py-3 pr-4">
                    <span className="block font-semibold">
                      {recipient.recipientName || recipient.recipientEmail}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {recipient.recipientEmail}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-semibold">{recipient.status}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(recipient.sentAt)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(recipient.openedAt)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(recipient.clickedAt)}
                  </td>
                  <td className="max-w-[18rem] truncate py-3 text-muted-foreground">
                    {recipient.error || ""}
                  </td>
                </tr>
              ))}
              {!recipients.length ? (
                <tr>
                  <td className="py-8 text-center text-muted-foreground" colSpan={6}>
                    No recipients yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              SendGrid
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              Recent delivery events
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing latest {events.length} rows
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Event</th>
                <th className="py-3 pr-4 font-semibold">Occurred</th>
                <th className="py-3 pr-4 font-semibold">URL</th>
                <th className="py-3 font-semibold">Message ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="py-3 pr-4 font-semibold">{event.eventType}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(event.occurredAt)}
                  </td>
                  <td className="max-w-[20rem] truncate py-3 pr-4 text-muted-foreground">
                    {event.url || ""}
                  </td>
                  <td className="max-w-[18rem] truncate py-3 text-muted-foreground">
                    {event.providerMessageId || ""}
                  </td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td className="py-8 text-center text-muted-foreground" colSpan={4}>
                    No SendGrid events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
