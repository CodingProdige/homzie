import "server-only";

import { sql } from "@/db";

import type { BroadcastAudience, BroadcastRecipient } from "./types";

type AudienceRow = {
  email: string;
  name: string | null;
  user_id: string;
};

type CountRow = {
  count: number;
};

function cleanText(value?: string) {
  return value?.trim() || "";
}

function buildAudienceQuery(audience: BroadcastAudience, countOnly: boolean) {
  const params: string[] = [];
  const clauses = [
    "u.status = 'active'",
    "u.email IS NOT NULL",
    "u.email <> ''",
    "COALESCE(p.email_enabled, true) = true",
  ];

  if (audience.requireMarketingOptIn) {
    clauses.push("COALESCE(p.marketing_enabled, false) = true");
  }

  const role = audience.role && audience.role !== "all" ? audience.role : "";
  if (role) {
    params.push(role);
    clauses.push(`u.profile_role = $${params.length}`);
  }

  const country = cleanText(audience.country);
  if (country) {
    params.push(country);
    clauses.push(`u.location_country ILIKE $${params.length}`);
  }

  const province = cleanText(audience.province);
  if (province) {
    params.push(province);
    clauses.push(`u.location_province ILIKE $${params.length}`);
  }

  if (audience.createdAfter) {
    params.push(audience.createdAfter);
    clauses.push(`u.created_at >= $${params.length}::timestamptz`);
  }

  if (audience.createdBefore) {
    params.push(audience.createdBefore);
    clauses.push(`u.created_at <= $${params.length}::timestamptz`);
  }

  if (audience.hasListings) {
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM property_listings pl
        WHERE pl.user_id = u.id
          AND pl.status <> 'archived'
      )
    `);
  }

  if (audience.hasReels) {
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM reels r
        WHERE r.user_id = u.id
      )
    `);
  }

  const select = countOnly
    ? "COUNT(DISTINCT u.id)::int AS count"
    : "DISTINCT u.id AS user_id, u.email, u.name";

  const orderLimit = countOnly ? "" : "ORDER BY u.created_at DESC, u.id DESC";

  return {
    params,
    query: `
      SELECT ${select}
      FROM users u
      LEFT JOIN user_notification_preferences p ON p.user_id = u.id
      WHERE ${clauses.join("\n        AND ")}
      ${orderLimit}
    `,
  };
}

export async function countBroadcastAudience(audience: BroadcastAudience) {
  const { params, query } = buildAudienceQuery(audience, true);
  const [row] = await sql.unsafe<CountRow[]>(query, params);

  return row?.count || 0;
}

export async function getBroadcastAudienceRecipients(
  audience: BroadcastAudience,
): Promise<BroadcastRecipient[]> {
  const { params, query } = buildAudienceQuery(audience, false);
  const rows = await sql.unsafe<AudienceRow[]>(query, params);

  return rows.map((row) => ({
    email: row.email,
    name: row.name,
    userId: row.user_id,
  }));
}
