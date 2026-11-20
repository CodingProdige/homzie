import "server-only";

import { alias, PgDialect } from "drizzle-orm/pg-core";

import { sql } from "@/db";
import { propertyListings } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import {
  agencyBadgeStyleFromSettings,
  type AgencyBadgeStyle,
} from "@/modules/agencies/brand-style";
import { agencyTypeLabel } from "@/modules/agencies/server";
import {
  formatCurrencyAmount,
  normalizeSupportedCurrency,
} from "@/modules/currency/currency";
import {
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import { buildListingPath } from "@/modules/listings/seo";
import { publicListingLocation } from "@/modules/listings/listing-validation";
import { publicListingVisibilityCondition } from "@/modules/listings/public-visibility";

// This module uses postgres.js queries. Compile the shared Drizzle condition
// with its fixed table alias and constants so both query styles use one rule.
const publicAgencyListingSql = new PgDialect().sqlToQuery(
  publicListingVisibilityCondition(alias(propertyListings, "pl")).inlineParams(),
).sql;

export type PublicAgencyType = "branch" | "independent" | "network";

export type PublicAgencyBrand = {
  agencyId: string;
  agencyType: PublicAgencyType;
  badgeLabel: string;
  badgeStyle: AgencyBadgeStyle;
  logoUrl: string | null;
  name: string;
  slug: string;
  source: "agency";
};

export type AgencyDirectoryItem = {
  activeListingCount: number;
  agentCount: number;
  branchCount: number;
  brand: PublicAgencyBrand;
  id: string;
  location: string | null;
  name: string;
  slug: string;
  type: PublicAgencyType;
};

export type PublicAgencyAgent = {
  activeListingCount: number;
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  avatarUrl: string | null;
  id: string;
  name: string;
  role: string;
  soldListingCount: number;
  username: string | null;
};

export type PublicAgencyBranch = {
  activeListingCount: number;
  agentCount: number;
  branchCode: string | null;
  id: string;
  location: string | null;
  name: string;
  slug: string;
  soldListingCount: number;
};

export type PublicAgencyListing = {
  agencyName: string;
  agencySlug: string;
  agentName: string;
  agentUsername: string | null;
  coverImageUrl: string | null;
  href: string;
  id: string;
  listedAt: string | null;
  listingTypeLabel: string;
  location: string;
  priceLabel: string;
  propertyTypeLabel: string;
  status: string;
  title: string;
};

export type PublicAgencyProfile = {
  activeListingCount: number;
  agents: PublicAgencyAgent[];
  branchCount: number;
  branches: PublicAgencyBranch[];
  brand: PublicAgencyBrand;
  id: string;
  listings: PublicAgencyListing[];
  location: string | null;
  name: string;
  parentAgency: {
    id: string;
    name: string;
    slug: string;
  } | null;
  slug: string;
  soldListingCount: number;
  type: PublicAgencyType;
  websiteUrl: string | null;
};

type AgencyRow = {
  agency_type: PublicAgencyType;
  badge_label: string | null;
  branch_count: number;
  id: string;
  listing_count: number;
  location: string | null;
  logo_url: string | null;
  member_count: number;
  name: string;
  settings: unknown;
  slug: string;
};

type AgencyProfileRow = {
  agency_type: PublicAgencyType;
  badge_label: string | null;
  id: string;
  location: string | null;
  logo_url: string | null;
  name: string;
  parent_agency_id: string | null;
  parent_agency_name: string | null;
  parent_agency_slug: string | null;
  settings: unknown;
  slug: string;
  website_url: string | null;
};

type AgencySummaryRow = {
  active_listing_count: number;
  agent_count: number;
  branch_count: number;
  sold_listing_count: number;
};

type AgencyBranchRow = {
  active_listing_count: number;
  agent_count: number;
  branch_code: string | null;
  id: string;
  location: string | null;
  name: string;
  slug: string;
  sold_listing_count: number;
};

type AgencyAgentRow = {
  active_listing_count: number;
  agency_id: string;
  agency_name: string;
  agency_slug: string;
  avatar_url: string | null;
  id: string;
  name: string;
  role: string;
  sold_listing_count: number;
  username: string | null;
};

type AgencyListingRow = {
  agency_name: string;
  agency_slug: string;
  agent_name: string;
  agent_username: string | null;
  asking_price_cents: number | null;
  cover_image_url: string | null;
  details: unknown;
  id: string;
  listed_at: Date | string | null;
  listing_currency: string;
  listing_type: string;
  location: string | null;
  media: unknown;
  price_label: string | null;
  property_type: string;
  status: string;
  title: string;
};

const agencyTypes = new Set<PublicAgencyType>([
  "branch",
  "independent",
  "network",
]);

function normalizeSearchParam(value?: string) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

export function normalizeAgencyTypeParam(value?: string) {
  return agencyTypes.has(value as PublicAgencyType)
    ? (value as PublicAgencyType)
    : "";
}

function brandFromAgency(row: {
  agency_type: PublicAgencyType;
  badge_label: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  settings: unknown;
  slug: string;
}): PublicAgencyBrand {
  return {
    agencyId: row.id,
    agencyType: row.agency_type,
    badgeLabel: row.badge_label || row.name,
    badgeStyle: agencyBadgeStyleFromSettings(row.settings),
    logoUrl: toPublicMediaUrl(row.logo_url),
    name: row.name,
    slug: row.slug,
    source: "agency",
  };
}

function optionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label || value;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function listingMediaUrls(value: unknown, mediaType: "image" | "video") {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const path = (item as { path?: unknown }).path;
      const type = (item as { type?: unknown }).type;
      const isVideo = typeof type === "string" && type.startsWith("video/");

      if (mediaType === "video" ? !isVideo : isVideo) return "";

      return typeof path === "string" ? toPublicMediaUrl(path) : "";
    })
    .filter((item): item is string => Boolean(item));
}

function listingCoverImageUrl(coverImageUrl: string | null, media: unknown) {
  const coverUrl = toPublicMediaUrl(coverImageUrl);
  const imageUrls = listingMediaUrls(media, "image");

  return imageUrls.includes(coverUrl || "") ? coverUrl : imageUrls[0] || coverUrl;
}

function formatPriceLabel(
  cents: number | null,
  listingCurrency: string | null,
  fallback: string | null,
) {
  if (typeof cents === "number" && cents > 0) {
    return formatCurrencyAmount(
      cents / 100,
      normalizeSupportedCurrency(listingCurrency),
    );
  }

  return fallback || "Price not set";
}

function mapListing(row: AgencyListingRow): PublicAgencyListing {
  const details = metadataObject(row.details);
  const location = publicListingLocation({
    addressVisibility: cleanString(details.addressVisibility),
    city: cleanString(details.city),
    country: cleanString(details.country),
    location: row.location,
    province:
      cleanString(details.province) ||
      cleanString(details.state) ||
      cleanString(details.region),
    suburb: cleanString(details.suburb),
  });

  return {
    agencyName: row.agency_name,
    agencySlug: row.agency_slug,
    agentName: row.agent_name,
    agentUsername: row.agent_username,
    coverImageUrl: listingCoverImageUrl(row.cover_image_url, row.media),
    href: buildListingPath({
      bathrooms: numberValue(details.bathrooms),
      bedrooms: numberValue(details.bedrooms),
      city: cleanString(details.city),
      country: cleanString(details.country),
      id: row.id,
      listingType: row.listing_type,
      location: row.location,
      propertyType: row.property_type,
      province:
        cleanString(details.province) ||
        cleanString(details.state) ||
        cleanString(details.region),
      suburb: cleanString(details.suburb),
      title: row.title,
    }),
    id: row.id,
    listedAt:
      row.listed_at instanceof Date
        ? row.listed_at.toISOString()
        : row.listed_at || null,
    listingTypeLabel: optionLabel(listingTypeOptions, row.listing_type),
    location: location || "Location hidden",
    priceLabel: formatPriceLabel(
      row.asking_price_cents,
      row.listing_currency,
      row.price_label,
    ),
    propertyTypeLabel: optionLabel(propertyTypeOptions, row.property_type),
    status: row.status,
    title: row.title,
  };
}

export function publicAgencyTypeLabel(type: PublicAgencyType) {
  return agencyTypeLabel(type);
}

export async function getAgencyDirectory({
  q,
  type,
}: {
  q?: string;
  type?: string;
}) {
  const search = normalizeSearchParam(q);
  const searchPattern = `%${search}%`;
  const agencyType = normalizeAgencyTypeParam(type);
  const rows = await sql<AgencyRow[]>`
    SELECT
      a.id,
      a.name,
      a.slug,
      a.agency_type,
      a.location,
      a.logo_url,
      a.badge_label,
      a.settings,
      coalesce(branch_stats.branch_count, 0)::int AS branch_count,
      coalesce(member_stats.member_count, 0)::int AS member_count,
      coalesce(member_stats.listing_count, 0)::int AS listing_count
    FROM agencies a
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS branch_count
      FROM agencies b
      WHERE b.parent_agency_id = a.id
        AND b.parent_link_status = 'linked'
        AND b.status = 'active'
        AND b.network_visibility_enabled = true
    ) branch_stats ON true
    LEFT JOIN LATERAL (
      SELECT
        count(DISTINCT am.user_id)::int AS member_count,
        count(DISTINCT pl.id) FILTER (
          WHERE pl.status = 'published' AND ${sql.unsafe(publicAgencyListingSql)}
        )::int AS listing_count
      FROM agencies scoped
      INNER JOIN agency_members am ON am.agency_id = scoped.id
      LEFT JOIN property_listings pl ON pl.user_id = am.user_id
      WHERE am.status = 'active'
        AND am.user_id IS NOT NULL
        AND scoped.status = 'active'
        AND (
          (
            a.agency_type = 'network'
            AND scoped.parent_agency_id = a.id
            AND scoped.parent_link_status = 'linked'
          )
          OR (
            a.agency_type <> 'network'
            AND scoped.id = a.id
          )
        )
    ) member_stats ON true
    WHERE a.status = 'active'
      AND a.network_visibility_enabled = true
      AND (
        ${search} = ''
        OR a.name ILIKE ${searchPattern}
        OR a.slug ILIKE ${searchPattern}
        OR coalesce(a.location, '') ILIKE ${searchPattern}
      )
      AND (${agencyType} = '' OR a.agency_type::text = ${agencyType})
    ORDER BY
      CASE a.agency_type
        WHEN 'network' THEN 0
        WHEN 'branch' THEN 1
        ELSE 2
      END,
      a.name ASC
    LIMIT 80
  `;

  return rows.map((row) => ({
    activeListingCount: row.listing_count,
    agentCount: row.member_count,
    branchCount: row.branch_count,
    brand: brandFromAgency(row),
    id: row.id,
    location: row.location,
    name: row.name,
    slug: row.slug,
    type: row.agency_type,
  }));
}

export async function getPublicAgencyProfile(slug: string) {
  const [agency] = await sql<AgencyProfileRow[]>`
    SELECT
      a.id,
      a.name,
      a.slug,
      a.agency_type,
      a.location,
      a.logo_url,
      a.badge_label,
      a.website_url,
      a.settings,
      parent.id AS parent_agency_id,
      parent.name AS parent_agency_name,
      parent.slug AS parent_agency_slug
    FROM agencies a
    LEFT JOIN agencies parent
      ON parent.id = a.parent_agency_id
      AND a.parent_link_status = 'linked'
      AND parent.status = 'active'
    WHERE a.slug = ${slug}
      AND a.status = 'active'
      AND a.network_visibility_enabled = true
    LIMIT 1
  `;

  if (!agency) return null;

  const [summary] = await sql<AgencySummaryRow[]>`
    WITH scoped_agencies AS (
      SELECT scoped.id
      FROM agencies scoped
      WHERE scoped.status = 'active'
        AND (
          (
            ${agency.agency_type} = 'network'
            AND scoped.parent_agency_id = ${agency.id}::uuid
            AND scoped.parent_link_status = 'linked'
          )
          OR (
            ${agency.agency_type} <> 'network'
            AND scoped.id = ${agency.id}::uuid
          )
        )
    )
    SELECT
      count(DISTINCT scoped_agencies.id) FILTER (WHERE ${agency.agency_type} = 'network')::int AS branch_count,
      count(DISTINCT am.user_id)::int AS agent_count,
      count(DISTINCT pl.id) FILTER (
        WHERE pl.status = 'published' AND ${sql.unsafe(publicAgencyListingSql)}
      )::int AS active_listing_count,
      count(DISTINCT pl.id) FILTER (WHERE pl.status = 'sold')::int AS sold_listing_count
    FROM scoped_agencies
    LEFT JOIN agency_members am
      ON am.agency_id = scoped_agencies.id
      AND am.status = 'active'
      AND am.user_id IS NOT NULL
    LEFT JOIN property_listings pl ON pl.user_id = am.user_id
  `;

  const [branches, agents, listingRows] = await Promise.all([
    agency.agency_type === "network"
      ? sql<AgencyBranchRow[]>`
          SELECT
            b.id,
            b.name,
            b.slug,
            b.location,
            b.branch_code,
            count(DISTINCT am.user_id)::int AS agent_count,
            count(DISTINCT pl.id) FILTER (
              WHERE pl.status = 'published' AND ${sql.unsafe(publicAgencyListingSql)}
            )::int AS active_listing_count,
            count(DISTINCT pl.id) FILTER (WHERE pl.status = 'sold')::int AS sold_listing_count
          FROM agencies b
          LEFT JOIN agency_members am
            ON am.agency_id = b.id
            AND am.status = 'active'
            AND am.user_id IS NOT NULL
          LEFT JOIN property_listings pl ON pl.user_id = am.user_id
          WHERE b.parent_agency_id = ${agency.id}::uuid
            AND b.parent_link_status = 'linked'
            AND b.status = 'active'
            AND b.network_visibility_enabled = true
          GROUP BY b.id, b.name, b.slug, b.location, b.branch_code
          ORDER BY active_listing_count DESC, agent_count DESC, b.name ASC
        `
      : Promise.resolve([] as AgencyBranchRow[]),
    sql<AgencyAgentRow[]>`
      WITH scoped_agencies AS (
        SELECT scoped.id, scoped.name, scoped.slug
        FROM agencies scoped
        WHERE scoped.status = 'active'
          AND (
            (
              ${agency.agency_type} = 'network'
              AND scoped.parent_agency_id = ${agency.id}::uuid
              AND scoped.parent_link_status = 'linked'
            )
            OR (
              ${agency.agency_type} <> 'network'
              AND scoped.id = ${agency.id}::uuid
            )
          )
      )
      SELECT
        u.id,
        u.name,
        u.username,
        u.avatar_url,
        am.role::text AS role,
        scoped_agencies.id AS agency_id,
        scoped_agencies.name AS agency_name,
        scoped_agencies.slug AS agency_slug,
        count(DISTINCT pl.id) FILTER (
          WHERE pl.status = 'published' AND ${sql.unsafe(publicAgencyListingSql)}
        )::int AS active_listing_count,
        count(DISTINCT pl.id) FILTER (WHERE pl.status = 'sold')::int AS sold_listing_count
      FROM scoped_agencies
      INNER JOIN agency_members am
        ON am.agency_id = scoped_agencies.id
        AND am.status = 'active'
        AND am.user_id IS NOT NULL
      INNER JOIN users u
        ON u.id = am.user_id
        AND u.status = 'active'
        AND u.profile_visible = true
      LEFT JOIN property_listings pl ON pl.user_id = u.id
      GROUP BY
        u.id,
        u.name,
        u.username,
        u.avatar_url,
        am.role,
        scoped_agencies.id,
        scoped_agencies.name,
        scoped_agencies.slug
      ORDER BY
        scoped_agencies.name ASC,
        CASE am.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'listing_manager' THEN 2
          ELSE 3
        END,
        u.name ASC
    `,
    sql<AgencyListingRow[]>`
      WITH scoped_agencies AS (
        SELECT scoped.id, scoped.name, scoped.slug
        FROM agencies scoped
        WHERE scoped.status = 'active'
          AND (
            (
              ${agency.agency_type} = 'network'
              AND scoped.parent_agency_id = ${agency.id}::uuid
              AND scoped.parent_link_status = 'linked'
            )
            OR (
              ${agency.agency_type} <> 'network'
              AND scoped.id = ${agency.id}::uuid
            )
          )
      )
      SELECT DISTINCT ON (pl.id)
        pl.id,
        pl.title,
        pl.location,
        pl.cover_image_url,
        pl.media,
        pl.details,
        pl.asking_price_cents,
        pl.listing_currency,
        pl.price_label,
        pl.property_type,
        pl.listing_type,
        pl.status,
        pl.listed_at,
        u.name AS agent_name,
        u.username AS agent_username,
        scoped_agencies.name AS agency_name,
        scoped_agencies.slug AS agency_slug
      FROM scoped_agencies
      INNER JOIN agency_members am
        ON am.agency_id = scoped_agencies.id
        AND am.status = 'active'
        AND am.user_id IS NOT NULL
      INNER JOIN users u
        ON u.id = am.user_id
        AND u.status = 'active'
      INNER JOIN property_listings pl ON pl.user_id = u.id
      WHERE pl.status IN ('published', 'reserved', 'sold')
        AND ${sql.unsafe(publicAgencyListingSql)}
      ORDER BY
        pl.id,
        CASE pl.status
          WHEN 'published' THEN 0
          WHEN 'reserved' THEN 1
          ELSE 2
        END,
        pl.listed_at DESC
      LIMIT 36
    `,
  ]);

  return {
    activeListingCount: summary?.active_listing_count || 0,
    agents: agents.map((agent) => ({
      activeListingCount: agent.active_listing_count,
      agencyId: agent.agency_id,
      agencyName: agent.agency_name,
      agencySlug: agent.agency_slug,
      avatarUrl: toPublicMediaUrl(agent.avatar_url),
      id: agent.id,
      name: agent.name,
      role: agent.role.replace(/_/g, " "),
      soldListingCount: agent.sold_listing_count,
      username: agent.username,
    })),
    branchCount: summary?.branch_count || 0,
    branches: branches.map((branch) => ({
      activeListingCount: branch.active_listing_count,
      agentCount: branch.agent_count,
      branchCode: branch.branch_code,
      id: branch.id,
      location: branch.location,
      name: branch.name,
      slug: branch.slug,
      soldListingCount: branch.sold_listing_count,
    })),
    brand: brandFromAgency(agency),
    id: agency.id,
    listings: listingRows.map(mapListing),
    location: agency.location,
    name: agency.name,
    parentAgency:
      agency.parent_agency_id &&
      agency.parent_agency_name &&
      agency.parent_agency_slug
        ? {
            id: agency.parent_agency_id,
            name: agency.parent_agency_name,
            slug: agency.parent_agency_slug,
          }
        : null,
    slug: agency.slug,
    soldListingCount: summary?.sold_listing_count || 0,
    type: agency.agency_type,
    websiteUrl: agency.website_url,
  };
}
