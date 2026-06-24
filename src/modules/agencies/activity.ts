import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db, sql } from "@/db";
import { agencies, agencyActivityEvents, agencyMembers, users } from "@/db/schema";
import { absoluteAppUrl, sendTemplatedEmailToUser } from "@/modules/email/server";

export type AgencyActivitySeverity = "action_required" | "info" | "success" | "warning";

export type AgencyActivityInput = {
  actionHref?: string | null;
  actionLabel?: string | null;
  actorAgencyId?: string | null;
  actorUserId?: string | null;
  agencyId: string;
  body: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  severity?: AgencyActivitySeverity;
  title: string;
};

type AgencyRecipient = {
  email: string;
  name: string;
  userId: string;
};

type AgencySummary = {
  id: string;
  name: string;
  slug: string;
};

async function getAgencyRecipients(agencyId: string) {
  return db
    .select({
      email: users.email,
      name: users.name,
      userId: users.id,
    })
    .from(agencyMembers)
    .innerJoin(users, eq(users.id, agencyMembers.userId))
    .where(
      and(
        eq(agencyMembers.agencyId, agencyId),
        eq(agencyMembers.status, "active"),
        inArray(agencyMembers.role, ["owner", "admin"]),
      ),
    );
}

async function getAgencySummary(agencyId: string | null | undefined) {
  if (!agencyId) return null;

  const [agency] = await db
    .select({
      id: agencies.id,
      name: agencies.name,
      slug: agencies.slug,
    })
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1);

  return agency || null;
}

function emailTemplateKey(eventType: string) {
  if (eventType === "agency.network_link.requested") {
    return "agency.network_link.requested";
  }

  if (eventType === "agency.network_link.approved") {
    return "agency.network_link.approved";
  }

  if (eventType === "agency.network_link.declined") {
    return "agency.network_link.declined";
  }

  if (eventType === "agency.network_link.left") {
    return "agency.network_link.left";
  }

  return null;
}

function emailVariables({
  actorAgency,
  event,
  recipient,
  targetAgency,
}: {
  actorAgency: AgencySummary | null;
  event: AgencyActivityInput;
  recipient: AgencyRecipient;
  targetAgency: AgencySummary | null;
}) {
  const actionUrl = absoluteAppUrl(event.actionHref || "/controlroom");
  const networkName =
    event.eventType === "agency.network_link.approved" ||
    event.eventType === "agency.network_link.declined"
      ? actorAgency?.name || "the network"
      : targetAgency?.name || "your network";
  const requestingName =
    event.eventType === "agency.network_link.approved" ||
    event.eventType === "agency.network_link.declined"
      ? targetAgency?.name || "your agency"
      : actorAgency?.name || "An agency";

  return {
    actor: {
      name: actorAgency?.name || "An agency",
      username: actorAgency?.slug || null,
    },
    agency: {
      actionLabel: event.actionLabel || "Open control room",
      actionUrl,
      name: targetAgency?.name || "your agency",
      networkName,
      requestingName,
      url: actionUrl,
    },
    app: { name: "Homzie", url: absoluteAppUrl("/") },
    event: {
      reason: event.body,
      type: event.eventType,
    },
    notification: { url: actionUrl },
    user: {
      firstName: recipient.name.split(" ")[0] || recipient.name,
      name: recipient.name,
    },
  };
}

export async function createAgencyActivityEvent(input: AgencyActivityInput) {
  await db.insert(agencyActivityEvents).values({
    actionHref: input.actionHref || null,
    actionLabel: input.actionLabel || null,
    actorAgencyId: input.actorAgencyId || null,
    actorUserId: input.actorUserId || null,
    agencyId: input.agencyId,
    body: input.body,
    eventType: input.eventType,
    metadata: input.metadata || {},
    severity: input.severity || "info",
    title: input.title,
  });
}

export async function notifyAgencyActivity(input: AgencyActivityInput) {
  await createAgencyActivityEvent(input);

  const templateKey = emailTemplateKey(input.eventType);

  if (!templateKey) return;

  const [recipients, targetAgency, actorAgency] = await Promise.all([
    getAgencyRecipients(input.agencyId),
    getAgencySummary(input.agencyId),
    getAgencySummary(input.actorAgencyId),
  ]);

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendTemplatedEmailToUser({
          bypassPreferences: true,
          eventKey: input.eventType,
          templateKey,
          userId: recipient.userId,
          variables: emailVariables({
            actorAgency,
            event: input,
            recipient,
            targetAgency,
          }),
        });
      } catch (error) {
        console.error("[agency-activity-email] send failed", error);
      }
    }),
  );
}

export async function getUnreadAgencyActivityCount(agencyId: string) {
  const [row] = await sql<Array<{ count: number | string }>>`
    SELECT count(*)::int AS count
    FROM agency_activity_events
    WHERE agency_id = ${agencyId}
      AND read_at IS NULL
      AND archived_at IS NULL
  `;

  return Number(row?.count || 0);
}
