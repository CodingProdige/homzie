"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { getAgencyBuyerActivityAccessForUser } from "@/modules/listings/agency-buyer-activity";

export async function clearAgencyBuyerActivityAction() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return;

  const access = await getAgencyBuyerActivityAccessForUser(userId);

  if (!access) return;

  await sql`
    WITH agency_listings AS (
      SELECT id
      FROM property_listings
      WHERE agency_id = ${access.agencyId}
        AND status = 'published'
        AND archived_at IS NULL
    ),
    activity_rows AS (
      SELECT
        lve.listing_id,
        coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key,
        lve.created_at
      FROM listing_view_events lve
      JOIN agency_listings al ON al.id = lve.listing_id
      WHERE lve.viewer_user_id IS NULL OR (
        lve.viewer_user_id <> ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM agency_members am
          WHERE am.agency_id = ${access.agencyId}
            AND am.user_id = lve.viewer_user_id
            AND am.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM agency_employees ae
          WHERE ae.agency_id = ${access.agencyId}
            AND ae.user_id = lve.viewer_user_id
            AND ae.status = 'active'
        )
      )
      UNION ALL
      SELECT
        lae.listing_id,
        coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key,
        lae.created_at
      FROM listing_action_events lae
      JOIN agency_listings al ON al.id = lae.listing_id
      WHERE lae.viewer_user_id IS NULL OR (
        lae.viewer_user_id <> ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM agency_members am
          WHERE am.agency_id = ${access.agencyId}
            AND am.user_id = lae.viewer_user_id
            AND am.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM agency_employees ae
          WHERE ae.agency_id = ${access.agencyId}
            AND ae.user_id = lae.viewer_user_id
            AND ae.status = 'active'
        )
      )
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

  revalidatePath(`${access.basePath}/buyer-activity`);
}
