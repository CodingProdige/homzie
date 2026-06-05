"use server";

import { sql as postgresSql } from "@/db";

const activeVisitorWindowMs = 90_000;
const staleVisitorWindowMs = 10 * 60_000;
const visitorIdPattern = /^[a-zA-Z0-9_-]{12,120}$/;

export type PlatformStats = {
  currentVisitors: number;
  totalAgents: number;
  totalListings: number;
  totalReels: number;
  totalSoldValueCents: number;
  totalUsers: number;
};

function numberFromAggregate(value: number | string | null | undefined) {
  return Number(value || 0);
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const activeSince = new Date(Date.now() - activeVisitorWindowMs).toISOString();
  const [row] = await postgresSql`
    SELECT
      (
        SELECT count(*)::int
        FROM platform_visitor_sessions
        WHERE last_seen_at >= ${activeSince}::timestamptz
      ) AS current_visitors,
      (
        SELECT count(*)::int
        FROM property_listings
        WHERE status = 'published'
      ) AS total_listings,
      (
        SELECT count(*)::int
        FROM reels
        WHERE status = 'published'
      ) AS total_reels,
      (
        SELECT coalesce(sum(sold_price_cents), 0)::bigint
        FROM property_listings
        WHERE status = 'sold'
          AND sold_price_cents IS NOT NULL
      ) AS total_sold_value_cents,
      (
        SELECT count(*)::int
        FROM users
        WHERE status = 'active'
      ) AS total_users,
      (
        SELECT count(*)::int
        FROM agent_profiles ap
        INNER JOIN users u ON u.id = ap.user_id
        WHERE ap.status = 'active'
          AND u.status = 'active'
      ) AS total_agents
  `;

  return {
    currentVisitors: numberFromAggregate(row?.current_visitors),
    totalAgents: numberFromAggregate(row?.total_agents),
    totalListings: numberFromAggregate(row?.total_listings),
    totalReels: numberFromAggregate(row?.total_reels),
    totalSoldValueCents: numberFromAggregate(row?.total_sold_value_cents),
    totalUsers: numberFromAggregate(row?.total_users),
  };
}

export async function heartbeatPlatformVisitor(visitorId: string) {
  if (!visitorIdPattern.test(visitorId)) {
    return getPlatformStats();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - staleVisitorWindowMs).toISOString();

  await postgresSql`
    DELETE FROM platform_visitor_sessions
    WHERE last_seen_at < ${staleBefore}::timestamptz
  `;

  await postgresSql`
    INSERT INTO platform_visitor_sessions (id, last_seen_at)
    VALUES (${visitorId}, ${nowIso}::timestamptz)
    ON CONFLICT (id)
    DO UPDATE SET last_seen_at = excluded.last_seen_at
  `;

  return getPlatformStats();
}
