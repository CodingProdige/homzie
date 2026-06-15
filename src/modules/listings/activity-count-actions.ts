"use server";

import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";

export async function getUnreadListingBuyerActivityCountAction() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return 0;

  const [row] = await sql<{ count: number }[]>`
    WITH active_subscription AS (
      SELECT EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE user_id = ${userId}
          AND status = 'active'
          AND (current_period_end IS NULL OR current_period_end > now())
      ) AS has_access
    ),
    owned_listings AS (
      SELECT id
      FROM property_listings
      WHERE user_id = ${userId}
        AND status = 'published'
        AND archived_at IS NULL
    ),
    activity_rows AS (
      SELECT
        lve.listing_id,
        coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
        lve.created_at
      FROM listing_view_events lve
      JOIN owned_listings ol ON ol.id = lve.listing_id
      WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
      UNION ALL
      SELECT
        lae.listing_id,
        coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
        lae.created_at
      FROM listing_action_events lae
      JOIN owned_listings ol ON ol.id = lae.listing_id
      WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
    ),
    viewer_latest AS (
      SELECT listing_id, viewer_key, max(created_at) AS latest_seen_at
      FROM activity_rows
      WHERE viewer_key IS NOT NULL
      GROUP BY listing_id, viewer_key
    )
    SELECT
      CASE
        WHEN (SELECT has_access FROM active_subscription) THEN count(*)::int
        ELSE 0
      END AS count
    FROM viewer_latest vl
    LEFT JOIN listing_activity_reads lar
      ON lar.listing_id = vl.listing_id
      AND lar.owner_user_id = ${userId}
      AND lar.viewer_key = vl.viewer_key
    WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
  `;

  return row?.count || 0;
}
