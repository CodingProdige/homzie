import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { CreateListingPage } from "@/modules/listings/components/create-listing-page";
import {
  draftFromListing,
  listingTypeValue,
  propertyTypeValue,
} from "@/modules/listings/listing-form-draft";
import {
  getActiveListingAssignedAgentIds,
  getAgencyListingAccessForUser,
  getAssignableAgencyListingAgents,
} from "@/modules/listings/agency-listing-access";
import { getAgencyEditableListingDetail } from "@/modules/listings/server/listing-data";
import { getListingStrengthBenchmark } from "@/modules/listings/server/listing-strength-benchmark";

type AgencyEditListingSearchParams = {
  listingError?: string;
  listingUpdated?: string;
};

type AgencyEditListingPageProps = {
  params: Promise<{
    listingId: string;
  }>;
  searchParams?: Promise<AgencyEditListingSearchParams>;
};

type CurrentUserRow = {
  username: string | null;
};

export const dynamic = "force-dynamic";

function listingUpdateFeedback(
  value?: string,
): "draft" | "published" | "updated" | undefined {
  if (value === "draft" || value === "published" || value === "updated") {
    return value;
  }

  if (value === "1") return "updated";

  return undefined;
}

export default async function AgencyEditListingPage({
  params,
  searchParams,
}: AgencyEditListingPageProps) {
  const { listingId } = await params;
  const query: AgencyEditListingSearchParams = searchParams
    ? await searchParams
    : {};
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/agency/listings/${listingId}/edit`);
  }

  const [access, listing, assignedAgentIds, [user]] = await Promise.all([
    getAgencyListingAccessForUser(session.user.id),
    getAgencyEditableListingDetail({ listingId, userId: session.user.id }),
    getActiveListingAssignedAgentIds(listingId),
    sql<CurrentUserRow[]>`
      SELECT username
      FROM users
      WHERE id = ${session.user.id}
      LIMIT 1
    `,
  ]);

  if (!access || !listing) {
    notFound();
  }

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [assignableAgents, listingStrengthBenchmark] = await Promise.all([
    getAssignableAgencyListingAgents(access.agencyId),
    getListingStrengthBenchmark({
      excludeListingId: listing.id,
      listingType: listingTypeValue(listing.listingType),
      propertyType: propertyTypeValue(listing.propertyType),
    }),
  ]);

  return (
    <CreateListingPage
      agencyContext={{
        agencyId: access.agencyId,
        agencyName: access.agencyName,
        assignableAgents,
        canPublishListings: access.canPublishListings,
        initialAssignedAgentIds: assignedAgentIds,
        returnPath: `${access.basePath}/listings`,
      }}
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
