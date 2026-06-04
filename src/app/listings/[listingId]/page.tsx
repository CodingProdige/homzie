import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { ListingDetailPage } from "@/modules/listings/components/listing-detail-page";
import { getListingDetail } from "@/modules/listings/server/listing-data";

type ListingPageProps = {
  params: Promise<{
    listingId: string;
  }>;
};

async function getViewerUsername(userId?: string | null) {
  if (!userId) return null;

  const [viewer] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return viewer?.username || null;
}

export async function generateMetadata({
  params,
}: ListingPageProps): Promise<Metadata> {
  const { listingId } = await params;
  const session = await getServerSession(authOptions);
  const listing = await getListingDetail({
    listingId,
    viewerUserId: session?.user?.id || null,
  });

  if (!listing) {
    return {
      title: "Listing not found | Homzie",
    };
  }

  return {
    title: `${listing.title} | Homzie`,
    description:
      listing.location ||
      `${listing.propertyTypeLabel} listed by ${listing.agent.name} on Homzie.`,
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { listingId } = await params;
  const session = await getServerSession(authOptions);
  const viewerUsername = await getViewerUsername(session?.user?.id);
  const listing = await getListingDetail({
    listingId,
    viewerUserId: session?.user?.id || null,
  });

  if (!listing) {
    notFound();
  }

  return (
    <ListingDetailPage
      listing={listing}
      viewerUsername={viewerUsername || undefined}
    />
  );
}
