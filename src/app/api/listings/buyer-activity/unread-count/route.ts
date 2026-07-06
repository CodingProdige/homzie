import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { hasBuyerIntentAccess } from "@/modules/access/agent-access";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId || !(await hasBuyerIntentAccess(userId))) {
    return Response.json(
      { count: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [row] = await sql<{ count: number }[]>`
    WITH accessible_listings AS (
      SELECT DISTINCT pl.id
      FROM property_listings pl
      LEFT JOIN property_listing_agents pla
        ON pla.listing_id = pl.id
        AND pla.user_id = ${userId}
        AND pla.removed_at IS NULL
      WHERE (pl.user_id = ${userId} OR pla.user_id IS NOT NULL)
        AND pl.status = 'published'
        AND pl.archived_at IS NULL
    ),
    activity_rows AS (
      SELECT
        lve.listing_id,
        coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
        lve.created_at
      FROM listing_view_events lve
      JOIN accessible_listings al ON al.id = lve.listing_id
      WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
      UNION ALL
      SELECT
        lae.listing_id,
        coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
        lae.created_at
      FROM listing_action_events lae
      JOIN accessible_listings al ON al.id = lae.listing_id
      WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
    ),
    viewer_latest AS (
      SELECT listing_id, viewer_key, max(created_at) AS latest_seen_at
      FROM activity_rows
      WHERE viewer_key IS NOT NULL
      GROUP BY listing_id, viewer_key
    )
    SELECT count(*)::int AS count
    FROM viewer_latest vl
    LEFT JOIN listing_activity_reads lar
      ON lar.listing_id = vl.listing_id
      AND lar.owner_user_id = ${userId}
      AND lar.viewer_key = vl.viewer_key
    WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
  `;

  return Response.json(
    { count: row?.count || 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
