import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  notificationSurfaceTemplates,
  type NotificationSurfaceTemplate,
} from "@/db/schema";
import {
  notificationRegistry,
  type NotificationRegistryItem,
} from "@/modules/notifications/registry";

export type NotificationSurface = "in_app" | "push";

const notificationVariables = [
  { key: "actor.name", label: "Actor name", fallback: "Someone" },
  { key: "actor.username", label: "Actor username" },
  { key: "agency.actionLabel", label: "Agency action label" },
  { key: "agency.actionUrl", label: "Agency action URL" },
  { key: "agency.name", label: "Agency name" },
  { key: "agency.networkName", label: "Network name" },
  { key: "agency.requestingName", label: "Requesting agency name" },
  { key: "agency.url", label: "Agency URL" },
  { key: "event.activeViewerCount", label: "Active viewer count" },
  { key: "event.count", label: "Event count" },
  { key: "event.reason", label: "Event reason" },
  { key: "listing.title", label: "Listing title" },
  { key: "message.preview", label: "Message preview" },
  { key: "notification.url", label: "Notification URL" },
  { key: "offer.amount", label: "Offer amount" },
  { key: "reel.title", label: "Reel title" },
];

const sampleVariables = {
  actor: { name: "Sarah Parker", username: "sarahparker" },
  agency: {
    actionLabel: "Review request",
    actionUrl: "https://homzie.co.za/controlroom/networkhq/branches",
    name: "Century 21",
    networkName: "Century 21",
    requestingName: "Century 21 Paarl",
    url: "https://homzie.co.za/controlroom/networkhq/branches",
  },
  event: {
    activeViewerCount: 3,
    count: 25,
    reason: "Conversation reported",
  },
  listing: { title: "Spacious 3-bedroom home" },
  message: { preview: "Hi, is this property still available?" },
  notification: { url: "https://homzie.co.za/events" },
  offer: { amount: "of R 3,500,000" },
  reel: { title: "a property reel" },
};

function defaultSurfaceTemplate(
  event: NotificationRegistryItem,
  surface: NotificationSurface,
) {
  return {
    body: surface === "push" ? event.pushBody : event.template,
    category: event.category,
    description: `${event.label} ${surface === "push" ? "push" : "in-app"} notification.`,
    enabled: surface === "push" ? event.defaultPushEnabled : true,
    eventKey: event.eventType,
    name: event.label,
    sampleVariables,
    surface,
    title: surface === "push" ? event.pushTitle : null,
    variables: notificationVariables,
  };
}

export async function ensureDefaultNotificationSurfaceTemplates() {
  const rows = notificationRegistry.flatMap((event) => [
    defaultSurfaceTemplate(event, "in_app"),
    defaultSurfaceTemplate(event, "push"),
  ]);

  for (const row of rows) {
    await db
      .insert(notificationSurfaceTemplates)
      .values(row)
      .onConflictDoNothing();
  }
}

export async function getNotificationSurfaceTemplate({
  eventKey,
  surface,
}: {
  eventKey: string;
  surface: NotificationSurface;
}) {
  await ensureDefaultNotificationSurfaceTemplates();

  const [template] = await db
    .select()
    .from(notificationSurfaceTemplates)
    .where(
      and(
        eq(notificationSurfaceTemplates.eventKey, eventKey),
        eq(notificationSurfaceTemplates.surface, surface),
      ),
    )
    .limit(1);

  return template || null;
}

export function fallbackNotificationSurfaceTemplate({
  event,
  surface,
}: {
  event: NotificationRegistryItem;
  surface: NotificationSurface;
}): Pick<NotificationSurfaceTemplate, "body" | "enabled" | "title"> {
  const fallback = defaultSurfaceTemplate(event, surface);

  return {
    body: fallback.body,
    enabled: fallback.enabled,
    title: fallback.title,
  };
}
