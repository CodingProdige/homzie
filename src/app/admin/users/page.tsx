import type { Metadata } from "next";

import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import {
  AdminUsersTable,
  type AdminUserRow,
} from "./users-table";

export const metadata: Metadata = {
  title: "Users | Homzie Admin",
  description: "Manage and inspect Homzie users.",
};

type AdminUserQueryRow = Omit<
  AdminUserRow,
  "avatarUrl" | "listingCount" | "reelCount"
> & {
  avatarUrl: string | null;
  listingCount: number | string | null;
  reelCount: number | string | null;
};

async function getUsers() {
  const rows = await sql<AdminUserQueryRow[]>`
    SELECT
      u.id,
      u.name,
      u.username,
      u.email,
      u.role,
      u.status,
      u.email_verified AS "emailVerified",
      u.avatar_url AS "avatarUrl",
      u.bio,
      u.location,
      u.location_place_id AS "locationPlaceId",
      u.contact_email AS "contactEmail",
      u.contact_phone AS "contactPhone",
      u.whatsapp_number AS "whatsappNumber",
      u.public_contact_visible AS "publicContactVisible",
      u.agent_trial_used_at::text AS "agentTrialUsedAt",
      u.pro_access_override_enabled AS "proAccessOverrideEnabled",
      u.pro_access_override_expires_at::text AS "proAccessOverrideExpiresAt",
      u.pro_access_override_reason AS "proAccessOverrideReason",
      u.pro_access_override_updated_at::text AS "proAccessOverrideUpdatedAt",
      u.created_at::text AS "createdAt",
      u.updated_at::text AS "updatedAt",
      ap.status AS "agentProfileStatus",
      aw.agency_id AS "agencyId",
      aw.agency_name AS "agencyName",
      aw.agency_slug AS "agencySlug",
      aw.agency_type AS "agencyType",
      aw.agency_status AS "agencyStatus",
      aw.member_role AS "agencyMemberRole",
      aw.member_status AS "agencyMemberStatus",
      coalesce(activity.last_online_at, u.created_at)::text AS "lastOnlineAt",
      (
        SELECT s.status
        FROM subscriptions s
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) AS "activeSubscriptionStatus",
      (
        SELECT s.current_period_start::text
        FROM subscriptions s
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) AS "subscriptionCurrentPeriodStart",
      (
        SELECT s.current_period_end::text
        FROM subscriptions s
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) AS "subscriptionCurrentPeriodEnd",
      (
        SELECT count(*)
        FROM property_listings pl
        WHERE pl.user_id = u.id
      ) AS "listingCount",
      (
        SELECT count(*)
        FROM reels r
        WHERE r.user_id = u.id
      ) AS "reelCount"
    FROM users u
    LEFT JOIN agent_profiles ap ON ap.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        a.id AS agency_id,
        a.name AS agency_name,
        a.slug AS agency_slug,
        a.agency_type,
        a.status AS agency_status,
        am.role AS member_role,
        am.status AS member_status
      FROM agency_members am
      INNER JOIN agencies a ON a.id = am.agency_id
      WHERE am.user_id = u.id
        AND am.status <> 'removed'
      ORDER BY
        CASE am.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'listing_manager' THEN 2
          ELSE 3
        END,
        am.created_at DESC
      LIMIT 1
    ) aw ON true
    LEFT JOIN LATERAL (
      SELECT max(activity_at) AS last_online_at
      FROM (
        SELECT max(last_seen_at) AS activity_at
        FROM listing_presence_sessions
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM listing_view_events
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM listing_action_events
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(last_watched_at)
        FROM reel_watch_sessions
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM reel_watch_events
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM reel_feedback
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM reel_listing_clicks
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM profile_view_events
        WHERE viewer_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM listing_saves
        WHERE user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM listing_likes
        WHERE user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM reel_saves
        WHERE user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM reel_likes
        WHERE user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM messages
        WHERE sender_user_id = u.id
        UNION ALL
        SELECT max(created_at)
        FROM user_events
        WHERE actor_user_id = u.id
      ) signed_in_activity
      WHERE activity_at IS NOT NULL
    ) activity ON true
    ORDER BY u.created_at DESC
  `;

  return rows.map((row) => ({
    ...row,
    avatarUrl: toPublicMediaUrl(row.avatarUrl),
    listingCount: Number(row.listingCount || 0),
    reelCount: Number(row.reelCount || 0),
  }));
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Users
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
          Search accounts by display name, username, or email, then inspect
          their profile, contact, and platform activity.
        </p>
      </div>

      <AdminUsersTable users={users} />
    </main>
  );
}
