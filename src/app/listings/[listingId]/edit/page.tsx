import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { CreateListingPage } from "@/modules/listings/components/create-listing-page";
import {
  getOwnedListingDetail,
} from "@/modules/listings/server/listing-data";
import { getListingStrengthBenchmark } from "@/modules/listings/server/listing-strength-benchmark";
import {
  draftFromListing,
  listingTypeValue,
  propertyTypeValue,
} from "@/modules/listings/listing-form-draft";

type EditListingPageProps = {
  params: Promise<{
    listingId: string;
  }>;
  searchParams?: Promise<{
    listingError?: string;
    listingUpdated?: string;
  }>;
};

function listingUpdateFeedback(
  value?: string,
): "draft" | "published" | "updated" | undefined {
  if (value === "draft" || value === "published" || value === "updated") {
    return value;
  }

  if (value === "1") return "updated";

  return undefined;
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

  const listingStrengthBenchmark = await getListingStrengthBenchmark({
    excludeListingId: listing.id,
    listingType: listingTypeValue(listing.listingType),
    propertyType: propertyTypeValue(listing.propertyType),
  });

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
      listingError={query.listingError}
      listingStrengthBenchmark={listingStrengthBenchmark}
      listingUpdateFeedback={listingUpdateFeedback(query.listingUpdated)}
      mode="edit"
      profilePath={`/users/${user.username}`}
    />
  );
}
