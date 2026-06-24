"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  agencies,
  agencyEmployees,
  agencyMembers,
  agencyOwnershipTransfers,
  users,
} from "@/db/schema";
import { getMediaStorageRoot } from "@/media/storage";
import { notifyAgencyActivity } from "@/modules/agencies/activity";
import {
  agencyBadgeFontOptions,
  agencyBadgeFontWeightOptions,
  agencyBadgeRadiusOptions,
  agencyBadgeStyleFromSettings,
  agencyControlRoomLogoPathFromSettings,
  agencySettingsWithBadgeStyle,
  defaultAgencyBadgeStyle,
  type AgencyBadgeStyle,
} from "@/modules/agencies/brand-style";
import { authOptions } from "@/modules/auth/config";
import {
  createAgencyWithOwner,
  getAgencyNameAvailability,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { controlRoomPathForWorkspace } from "@/modules/agencies/control-room";

export type AgencyApplicationState = {
  error?: string;
};

export type AgencyNameAvailability = {
  available: boolean;
  message: string;
  slug: string;
};

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function cleanOptionalText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength) || null;
}

function formJson(formData: FormData, key: string) {
  const raw = formString(formData, key);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function formAgencyType(value: string) {
  if (value === "network" || value === "branch") return value;

  return "independent";
}

function formBrandingPolicy(value: string) {
  return value === "network_branding_enforced"
    ? "network_branding_enforced"
    : "branch_branding_allowed";
}

const agencyLogoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxAgencyLogoBytes = 5 * 1024 * 1024;
const hexColorPattern = /^#[0-9a-f]{6}$/i;

function formColor(formData: FormData, key: string, fallback: string) {
  const value = formString(formData, key);

  return hexColorPattern.test(value) ? value : fallback;
}

function formOption(
  formData: FormData,
  key: string,
  options: readonly { value: string }[],
  fallback: string,
) {
  const value = formString(formData, key);

  return options.some((option) => option.value === value) ? value : fallback;
}

function agencyBadgeStyleFromForm(formData: FormData): AgencyBadgeStyle {
  return {
    backgroundColor: formColor(
      formData,
      "badgeBackgroundColor",
      defaultAgencyBadgeStyle.backgroundColor,
    ),
    borderRadius: formOption(
      formData,
      "badgeBorderRadius",
      agencyBadgeRadiusOptions,
      defaultAgencyBadgeStyle.borderRadius,
    ),
    fontFamily: formOption(
      formData,
      "badgeFontFamily",
      agencyBadgeFontOptions,
      defaultAgencyBadgeStyle.fontFamily,
    ),
    fontWeight: formOption(
      formData,
      "badgeFontWeight",
      agencyBadgeFontWeightOptions,
      defaultAgencyBadgeStyle.fontWeight,
    ),
    textColor: formColor(
      formData,
      "badgeTextColor",
      defaultAgencyBadgeStyle.textColor,
    ),
  };
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);

  return value instanceof File && value.size > 0 ? value : null;
}

async function storeAgencyLogo(
  file: File,
  agencyId: string,
  purpose: "control-room" | "public",
) {
  const extension = agencyLogoTypes[file.type];

  if (!extension) {
    throw new Error("Upload a JPG, PNG, or WebP logo image.");
  }

  if (file.size > maxAgencyLogoBytes) {
    throw new Error("Logo image must be 5MB or smaller.");
  }

  const now = new Date();
  const relativeDirectory = path.posix.join(
    "agencies",
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
  );
  const fileName = `${agencyId}-${purpose}-${randomUUID()}.${extension}`;
  const storedPath = path.posix.join(relativeDirectory, fileName);
  const storageRoot = getMediaStorageRoot();
  const absoluteDirectory = path.join(storageRoot, relativeDirectory);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(
    path.join(absoluteDirectory, fileName),
    Buffer.from(await file.arrayBuffer()),
  );

  return storedPath;
}

function agencyTypeControlRoomPath(agencyType: "branch" | "independent" | "network") {
  return agencyType === "network" ? "/controlroom/networkhq" : "/controlroom/agency";
}

function revalidateControlRoomPaths(path = "/controlroom") {
  revalidatePath("/controlroom");
  revalidatePath("/agency");
  revalidatePath(path);
  revalidatePath(`${path}/branches`);
  revalidatePath(`${path}/activity`);
  revalidatePath(`${path}/network`);
  revalidatePath(`${path}/leaderboard`);
  revalidatePath(`${path}/settings`);
}

export async function checkAgencyNameAvailability(
  name: string,
): Promise<AgencyNameAvailability> {
  return getAgencyNameAvailability(cleanOptionalText(name, 120) || "");
}

export async function createAgencyApplicationAction(
  _state: AgencyApplicationState,
  formData: FormData,
): Promise<AgencyApplicationState> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return { error: "Please sign in before creating an agency workspace." };
  }

  const name = formString(formData, "name");
  const agencyType = formAgencyType(formString(formData, "agencyType"));
  const parentAgencyId = formString(formData, "parentAgencyId");
  const branchCode =
    agencyType === "branch" ? cleanOptionalText(formString(formData, "branchCode"), 32) : null;
  const region =
    agencyType !== "network" ? cleanOptionalText(formString(formData, "region"), 160) : null;
  const regionPlaceId =
    agencyType !== "network"
      ? cleanOptionalText(formString(formData, "regionPlaceId"), 256)
      : null;
  const regionPlaceData = agencyType !== "network" ? formJson(formData, "regionPlaceData") : null;
  const websiteUrl = cleanOptionalText(formString(formData, "websiteUrl"), 300) || "";
  const contactEmail = cleanOptionalText(formString(formData, "contactEmail"), 254);
  const contactPhone = cleanOptionalText(formString(formData, "contactPhone"), 40);
  const location = cleanOptionalText(formString(formData, "location"), 160);

  if (name.length < 2) {
    return { error: "Add the agency name before continuing." };
  }

  const availability = await getAgencyNameAvailability(name);

  if (!availability.available) {
    return { error: availability.message };
  }

  let requestedParentAgencyName: string | null = null;
  let resolvedParentAgencyId: string | null = null;

  if (agencyType === "branch") {
    if (!parentAgencyId) {
      return { error: "Select the existing Network HQ this branch belongs to." };
    }

    const [parentAgency] = await db
      .select({ id: agencies.id, name: agencies.name })
      .from(agencies)
      .where(
        and(
          eq(agencies.id, parentAgencyId),
          eq(agencies.agencyType, "network"),
        ),
      )
      .limit(1);

    if (!parentAgency) {
      return { error: "Select a valid existing Network HQ." };
    }

    requestedParentAgencyName = parentAgency.name;
    resolvedParentAgencyId = parentAgency.id;
  }

  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
    return { error: "Website URL must start with http:// or https://." };
  }

  const [existingMembership] = await db
    .select({ agencyId: agencyMembers.agencyId })
    .from(agencyMembers)
    .where(eq(agencyMembers.userId, userId))
    .limit(1);

  if (existingMembership) {
    const workspace = await getPrimaryAgencyWorkspace(userId);

    redirect(controlRoomPathForWorkspace(workspace));
  }

  const agency = await createAgencyWithOwner({
    agencyType,
    billingOwnerUserId: userId,
    billingMode: "self",
    branchCode,
    contactEmail,
    contactPhone,
    createdByUserId: userId,
    location,
    name,
    parentAgencyId: resolvedParentAgencyId,
    parentLinkStatus: agencyType === "branch" ? "pending" : "none",
    region,
    regionPlaceData,
    regionPlaceId,
    requestedParentAgencyName,
    websiteUrl,
  });

  if (!agency) {
    return {
      error:
        "That agency name is no longer available. Use a more specific branch or network name.",
    };
  }

  const controlRoomPath = agencyTypeControlRoomPath(agencyType);

  revalidateControlRoomPaths(controlRoomPath);
  redirect(controlRoomPath);
}

async function requireNetworkManager() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Sign in before managing agency hierarchy.");
  }

  const workspace = await getPrimaryAgencyWorkspace(userId);

  if (
    !workspace ||
    workspace.agency.agencyType !== "network" ||
    !workspace.membership.canManageMembers
  ) {
    throw new Error("Only Network HQ owners and admins can manage branch links.");
  }

  return workspace;
}

export async function approveBranchLinkAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");

  if (!branchAgencyId) return;

  const session = await getServerSession(authOptions);
  const [branchAgency] = await db
    .select({
      id: agencies.id,
      name: agencies.name,
    })
    .from(agencies)
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    )
    .limit(1);

  if (!branchAgency) return;

  await db
    .update(agencies)
    .set({
      agencyType: "branch",
      billingMode: "self",
      brandingPolicy: workspace.agency.brandingPolicy,
      parentAgencyId: workspace.agency.id,
      parentLinkStatus: "linked",
      requestedParentAgencyName: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    );

  await notifyAgencyActivity({
    actionHref: "/controlroom/agency/network",
    actionLabel: "View network",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: branchAgency.id,
    body: `${workspace.agency.name} approved your request. Your agency is now linked to the network.`,
    eventType: "agency.network_link.approved",
    metadata: {
      networkAgencyId: workspace.agency.id,
      requestingAgencyId: branchAgency.id,
    },
    severity: "success",
    title: "Network request approved",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function updateNetworkBrandingPolicyAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const policy = formBrandingPolicy(formString(formData, "brandingPolicy"));
  const applyToBranches = formData.get("applyToBranches") === "on";

  await db.transaction(async (tx) => {
    await tx
      .update(agencies)
      .set({
        brandingPolicy: policy,
        updatedAt: new Date(),
      })
      .where(eq(agencies.id, workspace.agency.id));

    if (applyToBranches) {
      await tx
        .update(agencies)
        .set({
          brandingPolicy: policy,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agencies.parentAgencyId, workspace.agency.id),
            eq(agencies.agencyType, "branch"),
          ),
        );
    }
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function updateBranchBrandingPolicyAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");
  const policy = formBrandingPolicy(formString(formData, "brandingPolicy"));

  if (!branchAgencyId) return;

  await db
    .update(agencies)
    .set({
      brandingPolicy: policy,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        eq(agencies.agencyType, "branch"),
        eq(agencies.parentAgencyId, workspace.agency.id),
      ),
    );

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

async function requireAgencyManager() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Sign in before managing agency settings.");
  }

  const workspace = await getPrimaryAgencyWorkspace(userId);

  if (!workspace || !workspace.membership.canManageMembers) {
    throw new Error("Only agency owners and admins can manage agency settings.");
  }

  return workspace;
}

type AgencyEmployeeInviteRole =
  | "admin"
  | "finance"
  | "listing_coordinator"
  | "marketing"
  | "viewer";
type ManageableAgencyStatus = "active" | "removed" | "suspended";

function formAgencyEmployeeRole(value: string): AgencyEmployeeInviteRole {
  if (
    value === "admin" ||
    value === "listing_coordinator" ||
    value === "marketing" ||
    value === "finance" ||
    value === "viewer"
  ) {
    return value;
  }

  return "viewer";
}

function formMemberStatus(value: string): ManageableAgencyStatus {
  if (value === "active" || value === "suspended" || value === "removed") {
    return value;
  }

  return "active";
}

function employeePermissionsForRole(
  role: AgencyEmployeeInviteRole,
) {
  return {
    canManageBilling: role === "admin" || role === "finance",
    canManageBranding: role === "admin" || role === "marketing",
    canManageListings: role === "admin" || role === "listing_coordinator",
    canManageMembers: role === "admin",
    canViewBuyerActivity:
      role === "admin" || role === "listing_coordinator" || role === "marketing",
  };
}

export async function inviteAgencyMemberAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const session = await getServerSession(authOptions);
  const email = formString(formData, "email").toLowerCase();
  const role = "agent" as const;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid agent email address.");
  }

  const [existingUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const existingMembership = existingUser
    ? await db
        .select({ id: agencyMembers.id })
        .from(agencyMembers)
        .where(
          and(
            eq(agencyMembers.agencyId, workspace.agency.id),
            eq(agencyMembers.userId, existingUser.id),
          ),
        )
        .limit(1)
    : [];

  const values = {
    acceptedAt: existingUser ? new Date() : null,
    agencyFunded: true,
    canCreateListings: false,
    canEditAgencyListings: false,
    canManageBilling: false,
    canManageMembers: false,
    canPublishListings: false,
    canSubmitListingRequests: true,
    canViewBuyerActivity: true,
    invitedByUserId: session?.user?.id || null,
    invitedEmail: existingUser ? null : email,
    role,
    status: existingUser ? "active" as const : "invited" as const,
    updatedAt: new Date(),
    userId: existingUser?.id || null,
  };

  if (existingMembership[0]) {
    await db
      .update(agencyMembers)
      .set(values)
      .where(eq(agencyMembers.id, existingMembership[0].id));
  } else {
    await db.insert(agencyMembers).values({
      ...values,
      agencyId: workspace.agency.id,
    });
  }

  await notifyAgencyActivity({
    actionHref: `${controlRoomPathForWorkspace(workspace)}/members`,
    actionLabel: "View members",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: workspace.agency.id,
    body: existingUser
      ? `${existingUser.name} was linked as a paid agency agent.`
      : `${email} was invited as a paid agency agent.`,
    eventType: "agency.member.invited",
    metadata: { email, role },
    severity: "info",
    title: "Agency agent updated",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function updateAgencyMemberStatusAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const memberId = formString(formData, "memberId");
  const status = formMemberStatus(formString(formData, "status"));

  if (!memberId) return;

  const [member] = await db
    .select({ role: agencyMembers.role })
    .from(agencyMembers)
    .where(and(eq(agencyMembers.id, memberId), eq(agencyMembers.agencyId, workspace.agency.id)))
    .limit(1);

  if (!member || member.role === "owner") {
    throw new Error("Agency owners cannot be removed from the members page.");
  }

  await db
    .update(agencyMembers)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(agencyMembers.id, memberId), eq(agencyMembers.agencyId, workspace.agency.id)));

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function inviteAgencyEmployeeAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const session = await getServerSession(authOptions);
  const email = formString(formData, "email").toLowerCase();
  const role = formAgencyEmployeeRole(formString(formData, "role"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid employee email address.");
  }

  const [existingUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const existingEmployee = existingUser
    ? await db
        .select({ id: agencyEmployees.id })
        .from(agencyEmployees)
        .where(
          and(
            eq(agencyEmployees.agencyId, workspace.agency.id),
            eq(agencyEmployees.userId, existingUser.id),
          ),
        )
        .limit(1)
    : [];

  const values = {
    acceptedAt: existingUser ? new Date() : null,
    ...employeePermissionsForRole(role),
    invitedByUserId: session?.user?.id || null,
    invitedEmail: existingUser ? null : email,
    role,
    status: existingUser ? "active" as const : "invited" as const,
    updatedAt: new Date(),
    userId: existingUser?.id || null,
  };

  if (existingEmployee[0]) {
    await db
      .update(agencyEmployees)
      .set(values)
      .where(eq(agencyEmployees.id, existingEmployee[0].id));
  } else {
    await db.insert(agencyEmployees).values({
      ...values,
      agencyId: workspace.agency.id,
    });
  }

  await notifyAgencyActivity({
    actionHref: `${controlRoomPathForWorkspace(workspace)}/employees`,
    actionLabel: "View employees",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: workspace.agency.id,
    body: existingUser
      ? `${existingUser.name} was linked as an internal employee.`
      : `${email} was invited as an internal employee.`,
    eventType: "agency.employee.invited",
    metadata: { email, role },
    severity: "info",
    title: "Agency employee updated",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function updateAgencyEmployeeStatusAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const employeeId = formString(formData, "employeeId");
  const status = formMemberStatus(formString(formData, "status"));

  if (!employeeId) return;

  await db
    .update(agencyEmployees)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(agencyEmployees.id, employeeId),
        eq(agencyEmployees.agencyId, workspace.agency.id),
      ),
    );

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function updateAgencyBrandIdentityAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const publicLogoFile = formFile(formData, "publicLogoFile");
  const controlRoomLogoFile = formFile(formData, "controlRoomLogoFile");
  const publicBrandLocked =
    workspace.agency.agencyType === "branch" &&
    workspace.agency.brandingPolicy === "network_branding_enforced" &&
    workspace.agency.parentLinkStatus === "linked" &&
    Boolean(workspace.agency.parentAgencyId);
  const badgeLabel = publicBrandLocked
    ? workspace.agency.badgeLabel
    : cleanOptionalText(formString(formData, "badgeLabel"), 40);
  const badgeStyle = publicBrandLocked
    ? agencyBadgeStyleFromSettings(workspace.agency.settings)
    : agencyBadgeStyleFromForm(formData);

  const logoUrl = !publicBrandLocked && publicLogoFile
    ? await storeAgencyLogo(publicLogoFile, workspace.agency.id, "public")
    : workspace.agency.logoUrl;
  const controlRoomLogoPath = controlRoomLogoFile
    ? await storeAgencyLogo(
        controlRoomLogoFile,
        workspace.agency.id,
        "control-room",
      )
    : agencyControlRoomLogoPathFromSettings(workspace.agency.settings);

  await db
    .update(agencies)
    .set({
      badgeLabel,
      logoUrl,
      settings: agencySettingsWithBadgeStyle(
        workspace.agency.settings,
        badgeStyle,
        controlRoomLogoPath,
      ),
      updatedAt: new Date(),
    })
    .where(eq(agencies.id, workspace.agency.id));

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function declineBranchLinkAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");

  if (!branchAgencyId) return;

  const session = await getServerSession(authOptions);
  const [branchAgency] = await db
    .select({
      id: agencies.id,
      name: agencies.name,
    })
    .from(agencies)
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    )
    .limit(1);

  if (!branchAgency) return;

  await db
    .update(agencies)
    .set({
      billingMode: "self",
      parentAgencyId: null,
      parentLinkStatus: "declined",
      requestedParentAgencyName: workspace.agency.name,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    );

  await notifyAgencyActivity({
    actionHref: "/controlroom/agency/network",
    actionLabel: "View network",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: branchAgency.id,
    body: `${workspace.agency.name} declined your network link request.`,
    eventType: "agency.network_link.declined",
    metadata: {
      networkAgencyId: workspace.agency.id,
      requestingAgencyId: branchAgency.id,
    },
    severity: "warning",
    title: "Network request declined",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function unlinkBranchAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");

  if (!branchAgencyId) return;

  const session = await getServerSession(authOptions);
  const [branchAgency] = await db
    .select({
      id: agencies.id,
      name: agencies.name,
    })
    .from(agencies)
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        eq(agencies.agencyType, "branch"),
        eq(agencies.parentAgencyId, workspace.agency.id),
      ),
    )
    .limit(1);

  if (!branchAgency) return;

  await db
    .update(agencies)
    .set({
      agencyType: "independent",
      billingMode: "self",
      parentAgencyId: null,
      parentLinkStatus: "none",
      requestedParentAgencyName: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        eq(agencies.agencyType, "branch"),
        eq(agencies.parentAgencyId, workspace.agency.id),
      ),
    );

  await notifyAgencyActivity({
    actionHref: "/controlroom/agency/network",
    actionLabel: "View network",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: branchAgency.id,
    body: `${workspace.agency.name} unlinked your branch. Your agency is now independent.`,
    eventType: "agency.network_link.declined",
    metadata: {
      networkAgencyId: workspace.agency.id,
      requestingAgencyId: branchAgency.id,
    },
    severity: "warning",
    title: "Branch unlinked from network",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

async function requireNonNetworkAgencyManager() {
  const workspace = await requireAgencyManager();

  if (workspace.agency.agencyType === "network") {
    throw new Error("Network HQ workspaces manage branches from the Branches page.");
  }

  return workspace;
}

export async function requestNetworkLinkAction(formData: FormData) {
  const workspace = await requireNonNetworkAgencyManager();
  const networkAgencyId = formString(formData, "networkAgencyId");

  if (!networkAgencyId) {
    throw new Error("Select a Network HQ before sending the link request.");
  }

  if (workspace.agency.parentLinkStatus === "linked") {
    throw new Error("Leave the current network before requesting another one.");
  }

  const [networkAgency] = await db
    .select({
      id: agencies.id,
      name: agencies.name,
    })
    .from(agencies)
    .where(
      and(
        eq(agencies.id, networkAgencyId),
        eq(agencies.agencyType, "network"),
      ),
    )
    .limit(1);

  if (!networkAgency || networkAgency.id === workspace.agency.id) {
    throw new Error("Select a valid Network HQ.");
  }

  await db
    .update(agencies)
    .set({
      billingMode: "self",
      parentAgencyId: null,
      parentLinkStatus: "pending",
      requestedParentAgencyName: networkAgency.name,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, workspace.agency.id),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    );

  const session = await getServerSession(authOptions);

  await notifyAgencyActivity({
    actionHref: "/controlroom/networkhq/branches",
    actionLabel: "Review request",
    actorAgencyId: workspace.agency.id,
    actorUserId: session?.user?.id || null,
    agencyId: networkAgency.id,
    body: `${workspace.agency.name} requested to link to ${networkAgency.name}. Review the request from Branches.`,
    eventType: "agency.network_link.requested",
    metadata: {
      networkAgencyId: networkAgency.id,
      requestingAgencyId: workspace.agency.id,
    },
    severity: "action_required",
    title: "New branch affiliation request",
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
  revalidateControlRoomPaths("/controlroom/networkhq");
}

export async function leaveNetworkAction() {
  const workspace = await requireNonNetworkAgencyManager();
  const session = await getServerSession(authOptions);
  const parentAgencyId = workspace.agency.parentAgencyId;
  const parentAgencyName = workspace.agency.requestedParentAgencyName;

  await db
    .update(agencies)
    .set({
      agencyType: "independent",
      billingMode: "self",
      parentAgencyId: null,
      parentLinkStatus: "none",
      requestedParentAgencyName: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, workspace.agency.id),
        inArray(agencies.agencyType, ["branch", "independent"]),
      ),
    );

  if (parentAgencyId) {
    await notifyAgencyActivity({
      actionHref: "/controlroom/networkhq/branches",
      actionLabel: "View branches",
      actorAgencyId: workspace.agency.id,
      actorUserId: session?.user?.id || null,
      agencyId: parentAgencyId,
      body: `${workspace.agency.name} left ${parentAgencyName || "your network"}. The agency is now independent.`,
      eventType: "agency.network_link.left",
      metadata: {
        networkAgencyId: parentAgencyId,
        requestingAgencyId: workspace.agency.id,
      },
      severity: "info",
      title: "Branch left network",
    });
  }

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
  revalidateControlRoomPaths("/controlroom/networkhq");
}

async function requireAgencyOwner() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Sign in before managing agency ownership.");
  }

  const workspace = await getPrimaryAgencyWorkspace(userId);

  if (!workspace || workspace.membership.role !== "owner") {
    throw new Error("Only the current agency owner can transfer ownership.");
  }

  return { userId, workspace };
}

export async function requestAgencyOwnershipTransferAction(formData: FormData) {
  const { userId, workspace } = await requireAgencyOwner();
  const recipientEmail = formString(formData, "recipientEmail").toLowerCase();
  const message = cleanOptionalText(formString(formData, "message"), 500);

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error("Enter a valid recipient email address.");
  }

  const [recipient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, recipientEmail))
    .limit(1);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(agencyOwnershipTransfers)
      .set({
        cancelledAt: new Date(),
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agencyOwnershipTransfers.agencyId, workspace.agency.id),
          eq(agencyOwnershipTransfers.status, "pending"),
        ),
      );

    await tx.insert(agencyOwnershipTransfers).values({
      agencyId: workspace.agency.id,
      expiresAt,
      message,
      previousOwnerUserId: userId,
      recipientEmail,
      recipientUserId: recipient?.id || null,
      requestedByUserId: userId,
      status: "pending",
    });
  });

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function acceptAgencyOwnershipTransferAction(formData: FormData) {
  const transferId = formString(formData, "transferId");
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId || !transferId) {
    throw new Error("Sign in before accepting agency ownership.");
  }

  const [currentUser] = await db
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!currentUser) {
    throw new Error("Could not verify the signed-in account.");
  }

  const [transfer] = await db
    .select()
    .from(agencyOwnershipTransfers)
    .where(
      and(
        eq(agencyOwnershipTransfers.id, transferId),
        eq(agencyOwnershipTransfers.status, "pending"),
      ),
    )
    .limit(1);

  if (!transfer || transfer.expiresAt.getTime() < Date.now()) {
    throw new Error("This ownership transfer is no longer available.");
  }

  if (
    transfer.recipientEmail !== currentUser.email &&
    transfer.recipientUserId !== currentUser.id
  ) {
    throw new Error("This ownership transfer belongs to another email address.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(agencyMembers)
      .set({
        canManageBilling: true,
        canManageMembers: true,
        role: "admin",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agencyMembers.agencyId, transfer.agencyId),
          eq(agencyMembers.role, "owner"),
        ),
      );

    const [existingMembership] = await tx
      .select({ id: agencyMembers.id })
      .from(agencyMembers)
      .where(
        and(
          eq(agencyMembers.agencyId, transfer.agencyId),
          eq(agencyMembers.userId, currentUser.id),
        ),
      )
      .limit(1);

    const ownerPermissions = {
      acceptedAt: new Date(),
      agencyFunded: true,
      canCreateListings: true,
      canEditAgencyListings: true,
      canManageBilling: true,
      canManageMembers: true,
      canPublishListings: true,
      canSubmitListingRequests: true,
      canViewBuyerActivity: true,
      role: "owner" as const,
      status: "active" as const,
      updatedAt: new Date(),
    };

    if (existingMembership) {
      await tx
        .update(agencyMembers)
        .set(ownerPermissions)
        .where(eq(agencyMembers.id, existingMembership.id));
    } else {
      await tx.insert(agencyMembers).values({
        ...ownerPermissions,
        agencyId: transfer.agencyId,
        userId: currentUser.id,
      });
    }

    await tx
      .update(agencies)
      .set({
        billingOwnerUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(agencies.id, transfer.agencyId));

    await tx
      .update(agencyOwnershipTransfers)
      .set({
        acceptedAt: new Date(),
        recipientUserId: currentUser.id,
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(agencyOwnershipTransfers.id, transfer.id));
  });

  const workspace = await getPrimaryAgencyWorkspace(currentUser.id);
  const controlRoomPath = controlRoomPathForWorkspace(workspace);

  revalidateControlRoomPaths(controlRoomPath);
  redirect(controlRoomPath);
}

export async function declineAgencyOwnershipTransferAction(formData: FormData) {
  const transferId = formString(formData, "transferId");
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId || !transferId) return;

  const [currentUser] = await db
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!currentUser) return;

  await db
    .update(agencyOwnershipTransfers)
    .set({
      declinedAt: new Date(),
      status: "declined",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencyOwnershipTransfers.id, transferId),
        eq(agencyOwnershipTransfers.status, "pending"),
        eq(agencyOwnershipTransfers.recipientEmail, currentUser.email),
      ),
    );

  const workspace = await getPrimaryAgencyWorkspace(currentUser.id);

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}
