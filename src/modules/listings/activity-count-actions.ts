"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { hasBuyerIntentAccess } from "@/modules/access/agent-access";
import { authOptions } from "@/modules/auth/config";

export async function getUnreadListingBuyerActivityCountAction() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return 0;

  if (!(await hasBuyerIntentAccess(userId))) return 0;

  const [row] = await sql<{ count: number }[]>`
    WITH owned_listings AS (
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
    SELECT count(*)::int AS count
    FROM viewer_latest vl
    LEFT JOIN listing_activity_reads lar
      ON lar.listing_id = vl.listing_id
      AND lar.owner_user_id = ${userId}
      AND lar.viewer_key = vl.viewer_key
    WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
  `;

  return row?.count || 0;
}

export async function clearAllListingBuyerActivityAction() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return;

  await sql`
    WITH owned_listings AS (
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
    INSERT INTO listing_activity_reads (
      listing_id,
      owner_user_id,
      viewer_key,
      last_read_at,
      updated_at
    )
    SELECT
      listing_id,
      ${userId},
      viewer_key,
      latest_seen_at,
      now()
    FROM viewer_latest
    ON CONFLICT (listing_id, owner_user_id, viewer_key)
    DO UPDATE SET
      last_read_at = GREATEST(
        listing_activity_reads.last_read_at,
        EXCLUDED.last_read_at
      ),
      updated_at = now()
  `;

  revalidatePath("/listings/activity");
}

export async function clearListingBuyerActivityAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const listingId = String(formData.get("listingId") || "");

  if (!userId || !listingId) return;

  await sql`
    WITH owned_listing AS (
      SELECT id
      FROM property_listings
      WHERE id = ${listingId}
        AND user_id = ${userId}
      LIMIT 1
    ),
    activity_rows AS (
      SELECT
        lve.listing_id,
        coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
        lve.created_at
      FROM listing_view_events lve
      JOIN owned_listing ol ON ol.id = lve.listing_id
      WHERE lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId}
      UNION ALL
      SELECT
        lae.listing_id,
        coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
        lae.created_at
      FROM listing_action_events lae
      JOIN owned_listing ol ON ol.id = lae.listing_id
      WHERE lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId}
    ),
    viewer_latest AS (
      SELECT listing_id, viewer_key, max(created_at) AS latest_seen_at
      FROM activity_rows
      WHERE viewer_key IS NOT NULL
      GROUP BY listing_id, viewer_key
    )
    INSERT INTO listing_activity_reads (
      listing_id,
      owner_user_id,
      viewer_key,
      last_read_at,
      updated_at
    )
    SELECT
      listing_id,
      ${userId},
      viewer_key,
      latest_seen_at,
      now()
    FROM viewer_latest
    ON CONFLICT (listing_id, owner_user_id, viewer_key)
    DO UPDATE SET
      last_read_at = GREATEST(
        listing_activity_reads.last_read_at,
        EXCLUDED.last_read_at
      ),
      updated_at = now()
  `;

  revalidatePath("/listings/activity");
  revalidatePath(`/listings/${listingId}/activity`);
}
