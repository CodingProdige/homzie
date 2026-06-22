"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { agencies, agencyMembers, agencyOwnershipTransfers, users } from "@/db/schema";
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

function agencyTypeControlRoomPath(agencyType: "branch" | "independent" | "network") {
  return agencyType === "network" ? "/controlroom/networkhq" : "/controlroom/agency";
}

function revalidateControlRoomPaths(path = "/controlroom") {
  revalidatePath("/controlroom");
  revalidatePath("/agency");
  revalidatePath(path);
  revalidatePath(`${path}/branches`);
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

  await db
    .update(agencies)
    .set({
      billingMode: "parent",
      brandingPolicy: workspace.agency.brandingPolicy,
      parentAgencyId: workspace.agency.id,
      parentLinkStatus: "linked",
      requestedParentAgencyName: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        eq(agencies.agencyType, "branch"),
      ),
    );

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

export async function updateAgencyBrandIdentityAction(formData: FormData) {
  const workspace = await requireAgencyManager();
  const logoUrl = cleanOptionalText(formString(formData, "logoUrl"), 600);
  const badgeLabel = cleanOptionalText(formString(formData, "badgeLabel"), 40);

  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    throw new Error("Logo URL must start with http:// or https://.");
  }

  if (
    workspace.agency.agencyType === "branch" &&
    workspace.agency.brandingPolicy === "network_branding_enforced"
  ) {
    throw new Error("This branch is using Network HQ branding.");
  }

  await db
    .update(agencies)
    .set({
      badgeLabel,
      logoUrl,
      updatedAt: new Date(),
    })
    .where(eq(agencies.id, workspace.agency.id));

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function declineBranchLinkAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");

  if (!branchAgencyId) return;

  await db
    .update(agencies)
    .set({
      parentAgencyId: null,
      parentLinkStatus: "declined",
      requestedParentAgencyName: workspace.agency.name,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agencies.id, branchAgencyId),
        eq(agencies.agencyType, "branch"),
      ),
    );

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
}

export async function unlinkBranchAction(formData: FormData) {
  const workspace = await requireNetworkManager();
  const branchAgencyId = formString(formData, "branchAgencyId");

  if (!branchAgencyId) return;

  await db
    .update(agencies)
    .set({
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

  revalidateControlRoomPaths(controlRoomPathForWorkspace(workspace));
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
