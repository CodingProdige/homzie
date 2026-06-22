import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db, sql as rawSql } from "@/db";
import { agencies, agencyMembers } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";

type AgencyInsertClient = Pick<typeof db, "insert" | "select">;

export type EffectiveAgencyBrand = {
  agencyId: string;
  agencyType: "independent" | "network" | "branch";
  badgeLabel: string;
  logoUrl: string | null;
  name: string;
  source: "agency" | "network";
};

type EffectiveAgencyBrandRow = {
  agency_id: string;
  agency_type: "independent" | "network" | "branch";
  badge_label: string | null;
  logo_url: string | null;
  name: string;
  source: "agency" | "network";
  user_id: string;
};

export type AgencyWorkspace = {
  agency: {
    agencyType: "independent" | "network" | "branch";
    badgeLabel: string | null;
    billingMode: "self" | "parent";
    brandingPolicy: "branch_branding_allowed" | "network_branding_enforced";
    branchCode: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    id: string;
    location: string | null;
    logoUrl: string | null;
    name: string;
    networkVisibilityEnabled: boolean;
    parentAgencyId: string | null;
    parentLinkStatus: "none" | "pending" | "linked" | "declined";
    region: string | null;
    regionPlaceData: unknown;
    regionPlaceId: string | null;
    requestedParentAgencyName: string | null;
    slug: string;
    status: "pending" | "active" | "suspended";
    websiteUrl: string | null;
  };
  membership: {
    agencyFunded: boolean;
    canCreateListings: boolean;
    canEditAgencyListings: boolean;
    canManageBilling: boolean;
    canManageMembers: boolean;
    canPublishListings: boolean;
    canSubmitListingRequests: boolean;
    canViewBuyerActivity: boolean;
    role: "owner" | "admin" | "listing_manager" | "agent";
    status: "invited" | "active" | "suspended" | "removed";
  };
};

export async function getPrimaryAgencyWorkspace(
  userId: string,
): Promise<AgencyWorkspace | null> {
  const [row] = await db
    .select({
      agencyType: agencies.agencyType,
      agencyBadgeLabel: agencies.badgeLabel,
      agencyBillingMode: agencies.billingMode,
      agencyBrandingPolicy: agencies.brandingPolicy,
      agencyBranchCode: agencies.branchCode,
      agencyContactEmail: agencies.contactEmail,
      agencyContactPhone: agencies.contactPhone,
      agencyId: agencies.id,
      agencyLocation: agencies.location,
      agencyLogoUrl: agencies.logoUrl,
      agencyName: agencies.name,
      agencyNetworkVisibilityEnabled: agencies.networkVisibilityEnabled,
      agencyParentAgencyId: agencies.parentAgencyId,
      agencyParentLinkStatus: agencies.parentLinkStatus,
      agencyRegion: agencies.region,
      agencyRegionPlaceData: agencies.regionPlaceData,
      agencyRegionPlaceId: agencies.regionPlaceId,
      agencyRequestedParentAgencyName: agencies.requestedParentAgencyName,
      agencySlug: agencies.slug,
      agencyStatus: agencies.status,
      agencyWebsiteUrl: agencies.websiteUrl,
      agencyFunded: agencyMembers.agencyFunded,
      canCreateListings: agencyMembers.canCreateListings,
      canEditAgencyListings: agencyMembers.canEditAgencyListings,
      canManageBilling: agencyMembers.canManageBilling,
      canManageMembers: agencyMembers.canManageMembers,
      canPublishListings: agencyMembers.canPublishListings,
      canSubmitListingRequests: agencyMembers.canSubmitListingRequests,
      canViewBuyerActivity: agencyMembers.canViewBuyerActivity,
      memberRole: agencyMembers.role,
      memberStatus: agencyMembers.status,
    })
    .from(agencyMembers)
    .innerJoin(agencies, eq(agencies.id, agencyMembers.agencyId))
    .where(
      and(
        eq(agencyMembers.userId, userId),
        ne(agencyMembers.status, "removed"),
      ),
    )
    .orderBy(desc(agencyMembers.createdAt))
    .limit(1);

  if (!row) return null;

  return {
    agency: {
      agencyType: row.agencyType,
      badgeLabel: row.agencyBadgeLabel,
      billingMode: row.agencyBillingMode,
      brandingPolicy: row.agencyBrandingPolicy,
      branchCode: row.agencyBranchCode,
      contactEmail: row.agencyContactEmail,
      contactPhone: row.agencyContactPhone,
      id: row.agencyId,
      location: row.agencyLocation,
      logoUrl: row.agencyLogoUrl,
      name: row.agencyName,
      networkVisibilityEnabled: row.agencyNetworkVisibilityEnabled,
      parentAgencyId: row.agencyParentAgencyId,
      parentLinkStatus: row.agencyParentLinkStatus,
      region: row.agencyRegion,
      regionPlaceData: row.agencyRegionPlaceData,
      regionPlaceId: row.agencyRegionPlaceId,
      requestedParentAgencyName: row.agencyRequestedParentAgencyName,
      slug: row.agencySlug,
      status: row.agencyStatus,
      websiteUrl: row.agencyWebsiteUrl,
    },
    membership: {
      agencyFunded: row.agencyFunded,
      canCreateListings: row.canCreateListings,
      canEditAgencyListings: row.canEditAgencyListings,
      canManageBilling: row.canManageBilling,
      canManageMembers: row.canManageMembers,
      canPublishListings: row.canPublishListings,
      canSubmitListingRequests: row.canSubmitListingRequests,
      canViewBuyerActivity: row.canViewBuyerActivity,
      role: row.memberRole,
      status: row.memberStatus,
    },
  };
}

export function canonicalAgencySlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  return slug || "agency";
}

export async function isAgencySlugAvailable(
  slug: string,
  client: AgencyInsertClient = db,
) {
  const [existing] = await client
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.slug, slug))
    .limit(1);

  return !existing;
}

export async function getAgencyNameAvailability(name: string) {
  const slug = canonicalAgencySlug(name);

  if (slug.length < 2 || slug === "agency") {
    return {
      available: false,
      message: "Enter a more specific agency name.",
      slug,
    };
  }

  const available = await isAgencySlugAvailable(slug);

  return {
    available,
    message: available
      ? "Agency name is available."
      : "That agency name is already taken. Use a more specific branch or network name.",
    slug,
  };
}

export type AgencyNetworkOption = {
  id: string;
  label: string;
  location: string;
  region: string;
};

export async function getAgencyNetworkOptions(): Promise<AgencyNetworkOption[]> {
  const rows = await db
    .select({
      id: agencies.id,
      location: agencies.location,
      name: agencies.name,
      region: agencies.region,
    })
    .from(agencies)
    .where(eq(agencies.agencyType, "network"))
    .orderBy(agencies.name);

  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    location: row.location || "",
    region: row.region || "",
  }));
}

export async function createAgencyWithOwner({
  agencyType = "independent",
  billingOwnerUserId,
  billingMode,
  branchCode,
  brandingPolicy,
  contactEmail,
  contactPhone,
  createdByUserId,
  location,
  name,
  parentAgencyId,
  parentLinkStatus,
  region,
  regionPlaceData,
  regionPlaceId,
  requestedParentAgencyName,
  websiteUrl,
}: {
  agencyType?: "independent" | "network" | "branch";
  billingOwnerUserId: string;
  billingMode?: "self" | "parent";
  branchCode?: string | null;
  brandingPolicy?: "branch_branding_allowed" | "network_branding_enforced";
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdByUserId: string;
  location?: string | null;
  name: string;
  parentAgencyId?: string | null;
  parentLinkStatus?: "none" | "pending" | "linked" | "declined";
  region?: string | null;
  regionPlaceData?: unknown;
  regionPlaceId?: string | null;
  requestedParentAgencyName?: string | null;
  websiteUrl?: string | null;
}) {
  const resolvedBillingMode =
    billingMode || (agencyType === "branch" && parentAgencyId ? "parent" : "self");
  const resolvedParentLinkStatus =
    parentLinkStatus ||
    (agencyType === "branch"
      ? parentAgencyId
        ? "linked"
        : requestedParentAgencyName
          ? "pending"
          : "none"
      : "none");
  const slug = canonicalAgencySlug(name);
  const slugAvailable = await isAgencySlugAvailable(slug);

  if (!slugAvailable) return null;

  const [agency] = await db
    .insert(agencies)
    .values({
      agencyType,
      billingMode: resolvedBillingMode,
      brandingPolicy: brandingPolicy || "branch_branding_allowed",
      billingOwnerUserId,
      branchCode: branchCode || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      createdByUserId,
      location: location || null,
      name,
      networkVisibilityEnabled: true,
      parentAgencyId: parentAgencyId || null,
      parentLinkStatus: resolvedParentLinkStatus,
      region: region || null,
      regionPlaceData: regionPlaceData || null,
      regionPlaceId: regionPlaceId || null,
      requestedParentAgencyName: requestedParentAgencyName || null,
      slug,
      status: "pending",
      websiteUrl: websiteUrl || null,
    })
    .returning({ id: agencies.id });

  if (!agency) return null;

  await db.insert(agencyMembers).values({
    acceptedAt: new Date(),
    agencyFunded: true,
    agencyId: agency.id,
    canCreateListings: true,
    canEditAgencyListings: true,
    canManageBilling: true,
    canManageMembers: true,
    canPublishListings: true,
    canSubmitListingRequests: true,
    canViewBuyerActivity: true,
    role: "owner",
    status: "active",
    userId: createdByUserId,
  });

  return agency;
}

export async function getEffectiveAgencyBrandsForUsers(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueUserIds.length) return new Map<string, EffectiveAgencyBrand>();

  const rows = await rawSql<EffectiveAgencyBrandRow[]>`
    SELECT DISTINCT ON (am.user_id)
      am.user_id,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN parent.id
        ELSE a.id
      END AS agency_id,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN parent.agency_type
        ELSE a.agency_type
      END AS agency_type,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN parent.name
        ELSE a.name
      END AS name,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN parent.logo_url
        ELSE a.logo_url
      END AS logo_url,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN parent.badge_label
        ELSE a.badge_label
      END AS badge_label,
      CASE
        WHEN a.agency_type = 'branch'
          AND a.branding_policy = 'network_branding_enforced'
          AND a.parent_link_status = 'linked'
          AND parent.id IS NOT NULL
          THEN 'network'
        ELSE 'agency'
      END AS source
    FROM agency_members am
    INNER JOIN agencies a ON a.id = am.agency_id
    LEFT JOIN agencies parent ON parent.id = a.parent_agency_id
    WHERE am.user_id = ANY(${uniqueUserIds}::uuid[])
      AND am.status = 'active'
      AND a.status <> 'suspended'
    ORDER BY am.user_id, am.created_at DESC
  `;

  return new Map(
    rows.map((row) => [
      row.user_id,
      {
        agencyId: row.agency_id,
        agencyType: row.agency_type,
        badgeLabel: row.badge_label || row.name,
        logoUrl: toPublicMediaUrl(row.logo_url),
        name: row.name,
        source: row.source,
      },
    ]),
  );
}

export function agencyRoleLabel(role: AgencyWorkspace["membership"]["role"]) {
  if (role === "listing_manager") return "Listing manager";

  return role[0].toUpperCase() + role.slice(1);
}

export function agencyTypeLabel(type: AgencyWorkspace["agency"]["agencyType"]) {
  if (type === "network") return "Network HQ";
  if (type === "branch") return "Branch agency";

  return "Independent agency";
}

export function agencyBillingModeLabel(
  mode: AgencyWorkspace["agency"]["billingMode"],
) {
  return mode === "parent" ? "Parent-funded" : "Self-funded";
}

export function agencyBrandingPolicyLabel(
  policy: AgencyWorkspace["agency"]["brandingPolicy"],
) {
  return policy === "network_branding_enforced"
    ? "Network branding enforced"
    : "Branch branding allowed";
}
