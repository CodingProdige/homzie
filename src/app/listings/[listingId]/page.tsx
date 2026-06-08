import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { ListingDetailPage } from "@/modules/listings/components/listing-detail-page";
import { getListingDetail } from "@/modules/listings/server/listing-data";

type ListingPageProps = {
  params: Promise<{
    listingId: string;
  }>;
};

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
  const viewer = await getViewerChrome(session?.user?.id);
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
      viewerRole={viewer.role}
      viewerUsername={viewer.username}
    />
  );
}
