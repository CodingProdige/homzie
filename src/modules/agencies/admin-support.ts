import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { agencies, users } from "@/db/schema";
import { createAgencyActivityEvent } from "@/modules/agencies/activity";
import { authCookieOptions } from "@/modules/auth/session-cookie";

export const adminSupportAgencyCookieName = "homzie.admin-support-agency-id";

const supportCookieMaxAge = 60 * 60 * 4;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActiveAdminUser = {
  email: string;
  id: string;
  name: string;
};

type SupportAgencySummary = {
  agencyType: "independent" | "network" | "branch";
  id: string;
  name: string;
  status: "pending" | "active" | "suspended";
};

export type ActiveAdminSupportAccess = {
  adminEmail: string;
  adminName: string;
  adminUserId: string;
  agencyId: string;
  agencyName: string;
  agencyStatus: "pending" | "active" | "suspended";
  agencyType: "independent" | "network" | "branch";
};

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function supportControlRoomPathForAgencyType(
  agencyType: SupportAgencySummary["agencyType"],
) {
  return agencyType === "network"
    ? "/controlroom/networkhq"
    : "/controlroom/agency";
}

async function getActiveAdminUser(
  userId: string,
): Promise<ActiveAdminUser | null> {
  const [admin] = await db
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    return null;
  }

  return {
    email: admin.email,
    id: admin.id,
    name: admin.name,
  };
}

async function getSupportAgencySummary(
  agencyId: string,
): Promise<SupportAgencySummary | null> {
  if (!isUuid(agencyId)) return null;

  const [agency] = await db
    .select({
      agencyType: agencies.agencyType,
      id: agencies.id,
      name: agencies.name,
      status: agencies.status,
    })
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1);

  return agency || null;
}

async function logAdminSupportEvent({
  admin,
  agency,
  eventType,
  title,
}: {
  admin: ActiveAdminUser;
  agency: SupportAgencySummary;
  eventType: "agency.admin_support.started" | "agency.admin_support.ended";
  title: string;
}) {
  await createAgencyActivityEvent({
    actionHref: supportControlRoomPathForAgencyType(agency.agencyType),
    actionLabel: "Open control room",
    actorUserId: admin.id,
    agencyId: agency.id,
    body: `${admin.name || admin.email} used Homzie admin support access for this control room.`,
    eventType,
    metadata: {
      adminEmail: admin.email,
      adminSupport: true,
      adminUserId: admin.id,
      agencyType: agency.agencyType,
    },
    severity: "info",
    title,
  });
}

export async function getActiveAdminSupportAccess(
  userId: string,
): Promise<ActiveAdminSupportAccess | null> {
  const [admin, cookieStore] = await Promise.all([
    getActiveAdminUser(userId),
    cookies(),
  ]);

  if (!admin) return null;

  const agencyId =
    cookieStore.get(adminSupportAgencyCookieName)?.value.trim() || "";
  const agency = await getSupportAgencySummary(agencyId);

  if (!agency) return null;

  return {
    adminEmail: admin.email,
    adminName: admin.name,
    adminUserId: admin.id,
    agencyId: agency.id,
    agencyName: agency.name,
    agencyStatus: agency.status,
    agencyType: agency.agencyType,
  };
}

export async function startAdminAgencySupportAccess({
  adminUserId,
  agencyId,
}: {
  adminUserId: string;
  agencyId: string;
}) {
  const admin = await getActiveAdminUser(adminUserId);

  if (!admin) {
    throw new Error("Only active admins can open agency support access.");
  }

  const agency = await getSupportAgencySummary(agencyId);

  if (!agency) {
    throw new Error("Could not find that agency account.");
  }

  const cookieStore = await cookies();
  const previousAgencyId =
    cookieStore.get(adminSupportAgencyCookieName)?.value.trim() || "";

  if (previousAgencyId && previousAgencyId !== agency.id) {
    const previousAgency = await getSupportAgencySummary(previousAgencyId);

    if (previousAgency) {
      await logAdminSupportEvent({
        admin,
        agency: previousAgency,
        eventType: "agency.admin_support.ended",
        title: "Admin support session switched",
      });
    }
  }

  cookieStore.set(adminSupportAgencyCookieName, agency.id, {
    ...authCookieOptions,
    maxAge: supportCookieMaxAge,
  });

  await logAdminSupportEvent({
    admin,
    agency,
    eventType: "agency.admin_support.started",
    title: "Admin support session started",
  });

  return {
    controlRoomPath: supportControlRoomPathForAgencyType(agency.agencyType),
  };
}

export async function stopAdminAgencySupportAccess(
  adminUserId: string | null | undefined,
) {
  const cookieStore = await cookies();
  const agencyId =
    cookieStore.get(adminSupportAgencyCookieName)?.value.trim() || "";

  cookieStore.delete(adminSupportAgencyCookieName);

  if (!adminUserId) return null;

  const [admin, agency] = await Promise.all([
    getActiveAdminUser(adminUserId),
    getSupportAgencySummary(agencyId),
  ]);

  if (admin && agency) {
    await logAdminSupportEvent({
      admin,
      agency,
      eventType: "agency.admin_support.ended",
      title: "Admin support session ended",
    });
  }

  return agency;
}
