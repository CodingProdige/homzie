import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { cache } from "react";

import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { ListingDetailPage } from "@/modules/listings/components/listing-detail-page";
import {
  getListingDetail,
  getListingIdByShortId,
  type ListingDetailData,
} from "@/modules/listings/server/listing-data";
import {
  buildListingImageAlt,
  buildListingSeoDescription,
  buildListingSeoTitle,
  extractShortListingIdFromSlug,
} from "@/modules/listings/seo";
import {
  formatSeoTitle,
  getStoredSeoSettings,
} from "@/modules/seo/settings";
import {
  generatePropertyLandingMetadata,
  PropertyLandingPage,
} from "@/modules/seo/property-landing";
import { absoluteUrl } from "@/modules/site/url";

type PropertyListingPageProps = {
  params: Promise<{
    city: string;
    listingType: string;
    province: string;
    slug: string;
  }>;
};

const getPropertyListing = cache(async function getPropertyListing({
  shortId,
  viewerUserId,
}: {
  shortId: string;
  viewerUserId?: string | null;
}) {
  const listingId = await getListingIdByShortId(shortId);

  if (!listingId) {
    return null;
  }

  return getListingDetail({
    listingId,
    viewerUserId,
  });
});

function publicListingUrl(listing: ListingDetailData) {
  return absoluteUrl(listing.href);
}

function publicImageUrl(value: string | null | undefined) {
  return value ? absoluteUrl(value) : "";
}

function listingJsonLd(listing: ListingDetailData) {
  const listingUrl = publicListingUrl(listing);
  const images = [
    listing.coverImageUrl,
    ...listing.media.map((item) => item.previewUrl),
  ]
    .map(publicImageUrl)
    .filter(Boolean);
  const address = {
    "@type": "PostalAddress",
    addressCountry: listing.country || undefined,
    addressLocality: listing.city || undefined,
    addressRegion: listing.province || undefined,
    streetAddress: listing.suburb || listing.location || undefined,
  };
  const offer =
    listing.askingPriceCents && listing.askingPriceCents > 0
      ? {
          "@type": "Offer",
          availability:
            listing.status === "published"
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          price: (listing.askingPriceCents / 100).toFixed(0),
          priceCurrency: "ZAR",
          url: listingUrl,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@id": `${listingUrl}#listing`,
        "@type": "RealEstateListing",
        datePosted: listing.listedAt,
        description: buildListingSeoDescription(listing),
        image: images.length ? images : undefined,
        name: buildListingSeoTitle(listing),
        offers: offer,
        url: listingUrl,
      },
      {
        "@id": `${listingUrl}#property`,
        "@type": "Residence",
        address,
        floorSize: listing.floorSize
          ? {
              "@type": "QuantitativeValue",
              unitCode: "MTK",
              value: listing.floorSize,
            }
          : undefined,
        image: images.length ? images : undefined,
        name: listing.title,
        numberOfBathroomsTotal: listing.bathrooms || undefined,
        numberOfBedrooms: listing.bedrooms || undefined,
        url: listingUrl,
      },
      {
        "@id": `${listingUrl}#agent`,
        "@type": "RealEstateAgent",
        image: publicImageUrl(listing.agent.avatarUrl) || undefined,
        name: listing.agent.name,
        url: listing.agent.username
          ? absoluteUrl(`/users/${listing.agent.username}`)
          : undefined,
      },
      {
        "@id": `${listingUrl}#breadcrumbs`,
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            item: absoluteUrl("/property"),
            name: "Property",
            position: 1,
          },
          {
            "@type": "ListItem",
            item: listingUrl,
            name: buildListingSeoTitle(listing),
            position: 2,
          },
        ],
      },
    ],
  };
}

export async function generateMetadata({
  params,
}: PropertyListingPageProps): Promise<Metadata> {
  const { city, listingType, province, slug } = await params;
  const shortId = extractShortListingIdFromSlug(slug);

  if (!shortId) {
    return generatePropertyLandingMetadata({
      category: slug,
      city,
      listingType,
      province,
    });
  }

  const session = await getServerSession(authOptions);
  const [listing, seoSettings] = await Promise.all([
    getPropertyListing({
      shortId,
      viewerUserId: session?.user?.id || null,
    }),
    getStoredSeoSettings(),
  ]);

  if (!listing) {
    return {
      title: "Property not found | Homzie",
      robots: {
        follow: false,
        index: false,
      },
    };
  }

  const title = formatSeoTitle(
    buildListingSeoTitle(listing),
    seoSettings,
  );
  const description = buildListingSeoDescription(listing);
  const url = publicListingUrl(listing);
  const image = publicImageUrl(`${listing.href}/opengraph-image`);
  const unavailablePolicy = seoSettings.defaultUnavailableListingIndexing;
  const isIndexable =
    seoSettings.allowIndexing &&
    (listing.status === "published" ||
      (listing.status !== "published" && unavailablePolicy === "force_index"));

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      description,
      images: image
        ? [
            {
              alt: buildListingImageAlt(listing),
              url: image,
            },
          ]
        : undefined,
      siteName: "Homzie",
      title,
      type: "website",
      url,
    },
    robots: {
      follow: isIndexable,
      index: isIndexable,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: image ? [image] : undefined,
      title,
    },
  };
}

export default async function PropertyListingPage({
  params,
}: PropertyListingPageProps) {
  const { city, listingType, province, slug } = await params;
  const shortId = extractShortListingIdFromSlug(slug);

  if (!shortId) {
    return (
      <PropertyLandingPage
        category={slug}
        city={city}
        listingType={listingType}
        province={province}
      />
    );
  }

  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const listing = await getPropertyListing({
    shortId,
    viewerUserId: session?.user?.id || null,
  });

  if (!listing) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(listingJsonLd(listing)).replace(/</g, "\\u003c"),
        }}
      />
      <ListingDetailPage
        listing={listing}
        viewerAvatarUrl={viewer.avatarUrl}
        viewerName={viewer.name}
        viewerSignedIn={Boolean(session?.user?.id)}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
    </>
  );
}
