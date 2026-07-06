import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { agencies, users } from "@/db/schema";
import { toPublicMediaUrl } from "@/media/paths";
import { agencyBadgeStyleFromSettings } from "@/modules/agencies/brand-style";
import { publicAgencyTypeLabel } from "@/modules/agencies/public-directory";
import { normalizeUsername } from "@/modules/auth/username";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") || "").trim().slice(0, 80);
  const usernameQuery = normalizeUsername(rawQuery);
  const searchQuery = `%${rawQuery}%`;

  if (rawQuery.length < 2) {
    return Response.json({ agencies: [], users: [] });
  }

  const [userResults, agencyResults] = await Promise.all([
    db
      .select({
        avatarUrl: users.avatarUrl,
        id: users.id,
        name: users.name,
        username: users.username,
      })
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          eq(users.profileVisible, true),
          eq(users.searchVisible, true),
          isNotNull(users.username),
          or(
            usernameQuery ? ilike(users.username, `${usernameQuery}%`) : undefined,
            ilike(users.name, searchQuery),
          ),
        ),
      )
      .orderBy(asc(users.username))
      .limit(6),
    db
      .select({
        agencyType: agencies.agencyType,
        badgeLabel: agencies.badgeLabel,
        id: agencies.id,
        location: agencies.location,
        logoUrl: agencies.logoUrl,
        name: agencies.name,
        settings: agencies.settings,
        slug: agencies.slug,
      })
      .from(agencies)
      .where(
        and(
          eq(agencies.status, "active"),
          eq(agencies.networkVisibilityEnabled, true),
          or(
            ilike(agencies.name, searchQuery),
            ilike(agencies.slug, searchQuery),
            ilike(agencies.location, searchQuery),
          ),
        ),
      )
      .orderBy(asc(agencies.name))
      .limit(6),
  ]);

  return Response.json({
    agencies: agencyResults.map((agency) => ({
      agencyType: agency.agencyType,
      badgeLabel: agency.badgeLabel || agency.name,
      badgeStyle: agencyBadgeStyleFromSettings(agency.settings),
      id: agency.id,
      location: agency.location,
      logoUrl: toPublicMediaUrl(agency.logoUrl),
      name: agency.name,
      slug: agency.slug,
      typeLabel: publicAgencyTypeLabel(agency.agencyType),
    })),
    users: userResults
      .filter((user) => Boolean(user.username))
      .map((user) => ({
        avatarUrl: toPublicMediaUrl(user.avatarUrl),
        id: user.id,
        name: user.name,
        username: user.username || "",
      })),
  });
}
