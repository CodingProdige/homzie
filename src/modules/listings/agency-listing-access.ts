import "server-only";

import { and, eq, inArray, isNull, not } from "drizzle-orm";

import { db, sql } from "@/db";
import {
  agencyListingRequests,
  propertyListingAgents,
} from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import {
  getPrimaryAgencyWorkspace,
  type AgencyWorkspace,
} from "@/modules/agencies/server";

export type AssignableListingAgent = {
  avatarUrl: string | null;
  name: string;
  role: "admin" | "agent" | "listing_manager" | "owner";
  userId: string;
  username: string | null;
};

export type AgencyListingAccess = {
  agencyId: string;
  agencyName: string;
  agencyType: "branch" | "independent";
  basePath: string;
  canCreateListings: boolean;
  canEditAgencyListings: boolean;
  canPublishListings: boolean;
  canReviewListingRequests: boolean;
  canSubmitListingRequests: boolean;
  workspace: AgencyWorkspace;
};

export type ResolvedAgencyListingSubmission = {
  access: AgencyListingAccess;
  agencyId: string;
  assignedAgents: Array<{
    agentProfileId: string | null;
    userId: string;
  }>;
  finalStatus: "draft" | "pending_approval" | "published";
  leadAgentProfileId: string | null;
  leadUserId: string;
  requestedApproval: boolean;
};

type AssignableListingAgentRow = {
  avatar_url: string | null;
  name: string;
  role: "admin" | "agent" | "listing_manager" | "owner";
  user_id: string;
  username: string | null;
};

type ValidAssignedAgentRow = {
  agent_profile_id: string | null;
  user_id: string;
};

type ListingAssignmentWriter = Pick<typeof db, "insert" | "select" | "update">;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueUuidValues(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => uuidPattern.test(value)),
    ),
  );
}

export function controlRoomBasePathForAgencyType() {
  return "/controlroom/agency";
}

export function canUseAgencyListingWorkspace(workspace: AgencyWorkspace | null) {
  return Boolean(
    workspace &&
      workspace.agency.status === "active" &&
      workspace.agency.agencyType !== "network" &&
      workspace.membership.status === "active",
  );
}

export function agencyListingAccessFromWorkspace(
  workspace: AgencyWorkspace | null,
): AgencyListingAccess | null {
  if (!canUseAgencyListingWorkspace(workspace)) return null;

  const safeWorkspace = workspace as AgencyWorkspace & {
    agency: { agencyType: "branch" | "independent" };
  };
  const { membership } = safeWorkspace;
  const canEditAgencyListings = Boolean(membership.canEditAgencyListings);
  const canPublishListings = Boolean(
    membership.canPublishListings || canEditAgencyListings,
  );

  return {
    agencyId: safeWorkspace.agency.id,
    agencyName: safeWorkspace.agency.name,
    agencyType: safeWorkspace.agency.agencyType,
    basePath: controlRoomBasePathForAgencyType(),
    canCreateListings: Boolean(
      membership.canCreateListings || canEditAgencyListings,
    ),
    canEditAgencyListings,
    canPublishListings,
    canReviewListingRequests: canPublishListings,
    canSubmitListingRequests: Boolean(membership.canSubmitListingRequests),
    workspace: safeWorkspace,
  };
}

export async function getAgencyListingAccessForUser(userId: string) {
  return agencyListingAccessFromWorkspace(await getPrimaryAgencyWorkspace(userId));
}

export async function getAssignableAgencyListingAgents(
  agencyId: string,
): Promise<AssignableListingAgent[]> {
  const rows = await sql<AssignableListingAgentRow[]>`
    SELECT
      am.user_id,
      am.role,
      u.name,
      u.username,
      u.avatar_url
    FROM agency_members am
    INNER JOIN users u ON u.id = am.user_id
    WHERE am.agency_id = ${agencyId}
      AND am.status = 'active'
      AND am.user_id IS NOT NULL
    ORDER BY
      CASE am.role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'listing_manager' THEN 2
        ELSE 3
      END,
      u.name ASC
  `;

  return rows.map((row) => ({
    avatarUrl: toPublicMediaUrl(row.avatar_url),
    name: row.name,
    role: row.role,
    userId: row.user_id,
    username: row.username,
  }));
}

export async function getActiveListingAssignedAgentIds(listingId: string) {
  const rows = await sql<Array<{ user_id: string }>>`
    SELECT user_id
    FROM property_listing_agents
    WHERE listing_id = ${listingId}
      AND removed_at IS NULL
    ORDER BY
      CASE role WHEN 'lead' THEN 0 ELSE 1 END,
      sort_order ASC,
      created_at ASC
  `;

  return rows.map((row) => row.user_id);
}

async function getValidAssignedAgencyAgents({
  agencyId,
  requestedUserIds,
}: {
  agencyId: string;
  requestedUserIds: string[];
}) {
  if (!requestedUserIds.length) return [];

  const rows = await sql<ValidAssignedAgentRow[]>`
    SELECT
      am.user_id,
      ap.id AS agent_profile_id
    FROM agency_members am
    LEFT JOIN agent_profiles ap ON ap.user_id = am.user_id
    WHERE am.agency_id = ${agencyId}
      AND am.status = 'active'
      AND am.user_id = ANY(${requestedUserIds})
  `;
  const byUserId = new Map(rows.map((row) => [row.user_id, row]));

  return requestedUserIds
    .map((userId) => byUserId.get(userId))
    .filter((row): row is ValidAssignedAgentRow => Boolean(row));
}

export async function resolveAgencyListingSubmission({
  formData,
  intent,
  userId,
}: {
  formData: FormData;
  intent: "draft" | "published";
  userId: string;
}): Promise<ResolvedAgencyListingSubmission | null> {
  const requestedAgencyId = String(formData.get("agencyId") || "").trim();
  const access = await getAgencyListingAccessForUser(userId);

  if (!access) return null;

  if (requestedAgencyId && requestedAgencyId !== access.agencyId) {
    throw new Error("You do not have access to this agency workspace.");
  }

  if (requestedAgencyId && !access.canCreateListings) {
    throw new Error("You do not have permission to create agency listings.");
  }

  if (!requestedAgencyId && access.workspace.membership.accessType !== "member") {
    return null;
  }

  const requestedUserIds = uniqueUuidValues(formData.getAll("assignedAgentIds"));
  const fallbackUserIds = requestedUserIds.length ? requestedUserIds : [userId];
  let assignedAgents = await getValidAssignedAgencyAgents({
    agencyId: access.agencyId,
    requestedUserIds: fallbackUserIds,
  });

  if (!assignedAgents.length) {
    const assignableAgents = await getAssignableAgencyListingAgents(access.agencyId);
    assignedAgents = await getValidAssignedAgencyAgents({
      agencyId: access.agencyId,
      requestedUserIds: assignableAgents.slice(0, 1).map((agent) => agent.userId),
    });
  }

  if (!assignedAgents.length) {
    throw new Error("Select at least one active agency agent for this listing.");
  }

  const finalStatus =
    intent === "draft"
      ? "draft"
      : access.canPublishListings
        ? "published"
        : "pending_approval";

  if (finalStatus === "pending_approval" && !access.canSubmitListingRequests) {
    throw new Error("You do not have permission to submit listing requests.");
  }

  const leadAgent = assignedAgents[0];

  return {
    access,
    agencyId: access.agencyId,
    assignedAgents: assignedAgents.map((agent) => ({
      agentProfileId: agent.agent_profile_id,
      userId: agent.user_id,
    })),
    finalStatus,
    leadAgentProfileId: leadAgent.agent_profile_id,
    leadUserId: leadAgent.user_id,
    requestedApproval: finalStatus === "pending_approval",
  };
}

export async function assertCanEditListingForUser({
  agencyId,
  listingOwnerUserId,
  userId,
}: {
  agencyId: string | null;
  listingOwnerUserId: string;
  userId: string;
}) {
  if (listingOwnerUserId === userId) {
    return {
      access: await getAgencyListingAccessForUser(userId),
      canEdit: true,
      isAgencyManager: false,
    };
  }

  const access = await getAgencyListingAccessForUser(userId);

  if (agencyId && access?.agencyId === agencyId && access.canEditAgencyListings) {
    return { access, canEdit: true, isAgencyManager: true };
  }

  return { access, canEdit: false, isAgencyManager: false };
}

export async function syncListingAgentAssignments(
  writer: ListingAssignmentWriter,
  {
    actorUserId,
    agencyId,
    assignedAgents,
    listingId,
  }: {
    actorUserId: string;
    agencyId: string | null;
    assignedAgents: Array<{ agentProfileId: string | null; userId: string }>;
    listingId: string;
  },
) {
  const now = new Date();
  const selectedUserIds = assignedAgents.map((agent) => agent.userId);

  await writer
    .update(propertyListingAgents)
    .set({
      role: "co_agent",
      updatedAt: now,
    })
    .where(
      and(
        eq(propertyListingAgents.listingId, listingId),
        isNull(propertyListingAgents.removedAt),
      ),
    );

  if (selectedUserIds.length) {
    await writer
      .update(propertyListingAgents)
      .set({
        removedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(propertyListingAgents.listingId, listingId),
          isNull(propertyListingAgents.removedAt),
          not(inArray(propertyListingAgents.userId, selectedUserIds)),
        ),
      );
  }

  for (const [index, agent] of assignedAgents.entries()) {
    const [existing] = await writer
      .select({ id: propertyListingAgents.id })
      .from(propertyListingAgents)
      .where(
        and(
          eq(propertyListingAgents.listingId, listingId),
          eq(propertyListingAgents.userId, agent.userId),
        ),
      )
      .limit(1);

    const values = {
      agencyId,
      agentProfileId: agent.agentProfileId,
      assignedByUserId: actorUserId,
      removedAt: null,
      role: index === 0 ? ("lead" as const) : ("co_agent" as const),
      sortOrder: index,
      updatedAt: now,
    };

    if (existing) {
      await writer
        .update(propertyListingAgents)
        .set(values)
        .where(eq(propertyListingAgents.id, existing.id));
    } else {
      await writer.insert(propertyListingAgents).values({
        ...values,
        listingId,
        userId: agent.userId,
      });
    }
  }
}

export async function createPendingAgencyListingRequest(
  writer: Pick<typeof db, "insert">,
  {
    agencyId,
    listingId,
    requestedByUserId,
  }: {
    agencyId: string;
    listingId: string;
    requestedByUserId: string;
  },
) {
  await writer.insert(agencyListingRequests).values({
    agencyId,
    listingId,
    requestedByUserId,
    requestType: "publish",
    status: "pending",
  });
}
