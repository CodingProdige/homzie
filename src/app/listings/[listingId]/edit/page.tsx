import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  CreateListingPage,
  type ListingDraft,
} from "@/modules/listings/components/create-listing-page";
import {
  getOwnedListingDetail,
  type ListingDetailData,
} from "@/modules/listings/server/listing-data";
import {
  listingTypeOptions,
  propertyTypeOptions,
  type ListingType,
  type PropertyType,
} from "@/modules/listings/options";

type EditListingPageProps = {
  params: Promise<{
    listingId: string;
  }>;
  searchParams?: Promise<{
    listingUpdated?: string;
  }>;
};

function centsToInput(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value / 100)
    : "";
}

function numberToInput(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function listingTypeValue(value: string): ListingType {
  return listingTypeOptions.some((option) => option.value === value)
    ? (value as ListingType)
    : "sale";
}

function propertyTypeValue(value: string): PropertyType {
  return propertyTypeOptions.some((option) => option.value === value)
    ? (value as PropertyType)
    : "free_standing_house";
}

function listingUpdateFeedback(
  value?: string,
): "draft" | "published" | "updated" | undefined {
  if (value === "draft" || value === "published" || value === "updated") {
    return value;
  }

  if (value === "1") return "updated";

  return undefined;
}

function draftFromListing(listing: ListingDetailData): Partial<ListingDraft> {
  return {
    askingPrice: centsToInput(listing.askingPriceCents),
    availableFrom: listing.availableFrom || "",
    bathrooms: numberToInput(listing.bathrooms),
    bedrooms: numberToInput(listing.bedrooms),
    buyerIncentive: listing.buyerIncentive,
    city: listing.city,
    communityFees: centsToInput(listing.communityFeesCents),
    country: listing.country,
    description: listing.description || "",
    erfSize: numberToInput(listing.erfSize),
    features: listing.features,
    floorSize: numberToInput(listing.floorSize),
    furnishedStatus: listing.furnishedStatus,
    garages: numberToInput(listing.garages),
    googlePlaceData: listing.googlePlaceData,
    googlePlaceId: listing.googlePlaceId,
    insuranceEstimate: centsToInput(listing.insuranceEstimateCents),
    listingType: listingTypeValue(listing.listingType),
    location: listing.location || "",
    localTaxes: centsToInput(listing.localTaxesCents),
    mandateEndDate: listing.mandateEndDate,
    mandateStartDate: listing.mandateStartDate,
    mandateType: listing.mandateType,
    parking: numberToInput(listing.parking),
    petsAllowed: listing.petsAllowed,
    previousAskingPrice: centsToInput(listing.previousAskingPriceCents),
    priceQualifier: listing.priceQualifier,
    propertyType: propertyTypeValue(listing.propertyType),
    province: listing.province,
    reservationAmount: centsToInput(listing.reservationAmountCents),
    reservationEnabled: listing.reservationEnabled,
    rentalYield: numberToInput(listing.rentalYield),
    shortLetAllowed: listing.shortLetAllowed,
    suburb: listing.suburb,
    title: listing.title,
    transferCostsEstimate: centsToInput(listing.transferCostsEstimateCents),
    utilitiesEstimate: centsToInput(listing.utilitiesEstimateCents),
  };
}

export default async function EditListingPage({
  params,
  searchParams,
}: EditListingPageProps) {
  const { listingId } = await params;
  const query = searchParams ? await searchParams : {};
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const listing = await getOwnedListingDetail({
    listingId,
    userId: session.user.id,
  });

  if (!listing) {
    notFound();
  }

  return (
    <CreateListingPage
      initialCoverIndex={Math.max(
        listing.media.findIndex(
          (item) => item.previewUrl === listing.coverImageUrl,
        ),
        0,
      )}
      initialDraft={draftFromListing(listing)}
      initialMedia={listing.media.map((item) => ({
        name: item.name,
        path: item.path,
        size: item.size,
        type: item.type,
      }))}
      initialPublishIntent={listing.status === "draft" ? "draft" : "published"}
      listingId={listing.id}
      listingUpdateFeedback={listingUpdateFeedback(query.listingUpdated)}
      mode="edit"
      profilePath={`/users/${user.username}`}
    />
  );
}
