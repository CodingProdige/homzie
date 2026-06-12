import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { ListingDetailPage } from "@/modules/listings/components/listing-detail-page";
import { getListingDetail } from "@/modules/listings/server/listing-data";
import {
  buildListingSeoDescription,
  buildListingSeoTitle,
} from "@/modules/listings/seo";
import { absoluteUrl } from "@/modules/site/url";

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

  const title = `${buildListingSeoTitle(listing)} | Homzie`;
  const description = buildListingSeoDescription(listing);

  return {
    alternates: {
      canonical: absoluteUrl(listing.href),
    },
    description,
    openGraph: {
      description,
      images: listing.coverImageUrl
        ? [{ url: absoluteUrl(listing.coverImageUrl) }]
        : undefined,
      siteName: "Homzie",
      title,
      type: "website",
      url: absoluteUrl(listing.href),
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: listing.coverImageUrl ? [absoluteUrl(listing.coverImageUrl)] : undefined,
      title,
    },
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
