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
      u.created_at::text AS "createdAt",
      u.updated_at::text AS "updatedAt",
      ap.status AS "agentProfileStatus",
      (
        SELECT s.status
        FROM subscriptions s
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) AS "activeSubscriptionStatus",
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
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Users
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Search accounts by display name, username, or email, then inspect
          their profile, contact, and platform activity.
        </p>
      </div>

      <AdminUsersTable users={users} />
    </main>
  );
}
