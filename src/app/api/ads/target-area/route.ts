import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, countDistinct, eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { propertyIdentities, propertyListings, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getTargetAreaPopulationEstimate } from "@/modules/ads/target-area-population";

const requestSchema = z.object({
  locations: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        placeId: z.string().trim().min(1).max(180),
      }),
    )
    .min(1)
    .max(8),
});

const GLOBAL_TARGET_PLACE_ID = "__global__";
const GLOBAL_TARGET_LABEL = "All countries and regions";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid target area request." }, { status: 400 });
  }

  const stats = await Promise.all(
    parsed.data.locations.map(async (location) => {
      if (location.placeId === GLOBAL_TARGET_PLACE_ID) {
        const [[activeUsersRow], [publishedListingsRow]] = await Promise.all([
          db
            .select({
              count: countDistinct(users.id),
            })
            .from(users)
            .where(eq(users.status, "active")),
          db
            .select({
              count: countDistinct(propertyListings.id),
            })
            .from(propertyListings)
            .where(eq(propertyListings.status, "published")),
        ]);

        return {
          activeUsersEstimate: activeUsersRow?.count || 0,
          label: GLOBAL_TARGET_LABEL,
          placeId: GLOBAL_TARGET_PLACE_ID,
          populationEstimate: 0,
          publishedListingsEstimate: publishedListingsRow?.count || 0,
        };
      }

      const populationEstimatePromise = getTargetAreaPopulationEstimate({
        label: location.label,
        placeId: location.placeId,
      });

      const [activeUsersRow] = await db
        .select({
          count: countDistinct(users.id),
        })
        .from(users)
        .where(
          and(
            eq(users.status, "active"),
            or(
              eq(users.locationPlaceId, location.placeId),
              eq(users.location, location.label),
            ),
          ),
        );

      const [publishedListingsRow] = await db
        .select({
          count: countDistinct(propertyListings.id),
        })
        .from(propertyListings)
        .leftJoin(
          propertyIdentities,
          eq(propertyListings.propertyIdentityId, propertyIdentities.id),
        )
        .where(
          and(
            eq(propertyListings.status, "published"),
            or(
              eq(propertyIdentities.googlePlaceId, location.placeId),
              eq(propertyListings.location, location.label),
            ),
          ),
        );

      const populationEstimate = await populationEstimatePromise;

      return {
        activeUsersEstimate: activeUsersRow?.count || 0,
        label: location.label,
        placeId: location.placeId,
        populationEstimate,
        publishedListingsEstimate: publishedListingsRow?.count || 0,
      };
    }),
  );

  return NextResponse.json({ stats });
}
