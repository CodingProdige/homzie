import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { propertyListings } from "@/db/schema";
import type { ListingStrengthBenchmark } from "@/modules/listings/listing-validation";

type BenchmarkInput = {
  excludeListingId?: string;
  listingType: string;
  propertyType: string;
};

export async function getListingStrengthBenchmark({
  excludeListingId,
  listingType,
  propertyType,
}: BenchmarkInput): Promise<ListingStrengthBenchmark | null> {
  const conditions = [
    eq(propertyListings.status, "published"),
    eq(propertyListings.listingType, listingType),
    eq(propertyListings.propertyType, propertyType),
  ];

  if (excludeListingId) {
    conditions.push(ne(propertyListings.id, excludeListingId));
  }

  const [row] = await db
    .select({
      averageDescriptionLength: sql<number>`
        coalesce(
          avg(length(regexp_replace(coalesce(${propertyListings.description}, ''), '<[^>]+>', '', 'g'))),
          0
        )
      `,
      averageMediaCount: sql<number>`
        coalesce(
          avg(
            case
              when jsonb_typeof(${propertyListings.media}) = 'array'
              then jsonb_array_length(${propertyListings.media})
              else 0
            end
          ),
          0
        )
      `,
      sampleSize: sql<number>`count(*)::int`,
    })
    .from(propertyListings)
    .where(and(...conditions));

  if (!row?.sampleSize) return null;

  return {
    averageDescriptionLength: Math.round(Number(row.averageDescriptionLength) || 0),
    averageMediaCount: Math.round(Number(row.averageMediaCount) || 0),
    listingType,
    propertyType,
    sampleSize: row.sampleSize,
  };
}
