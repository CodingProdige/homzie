import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { CreateListingPage } from "@/modules/listings/components/create-listing-page";
import {
  getAgencyListingAccessForUser,
  getAssignableAgencyListingAgents,
} from "@/modules/listings/agency-listing-access";
import { getListingStrengthBenchmark } from "@/modules/listings/server/listing-strength-benchmark";

type AgencyNewListingSearchParams = {
  duplicateListing?: string;
  listingError?: string;
  listingPublished?: string;
};

type AgencyNewListingPageProps = {
  searchParams?: Promise<AgencyNewListingSearchParams>;
};

type CurrentUserRow = {
  username: string | null;
};

export const dynamic = "force-dynamic";

export default async function AgencyNewListingPage({
  searchParams,
}: AgencyNewListingPageProps) {
  const query: AgencyNewListingSearchParams = searchParams
    ? await searchParams
    : {};
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listings/new");
  }

  const [access, [user]] = await Promise.all([
    getAgencyListingAccessForUser(session.user.id),
    sql<CurrentUserRow[]>`
      SELECT username
      FROM users
      WHERE id = ${session.user.id}
      LIMIT 1
    `,
  ]);

  if (!access || !access.canCreateListings) {
    notFound();
  }

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [assignableAgents, listingStrengthBenchmark] = await Promise.all([
    getAssignableAgencyListingAgents(access.agencyId),
    getListingStrengthBenchmark({
      listingType: "sale",
      propertyType: "free_standing_house",
    }),
  ]);

  if (!assignableAgents.length) {
    notFound();
  }

  const currentUserAssignable = assignableAgents.some(
    (agent) => agent.userId === session.user.id,
  );

  return (
    <CreateListingPage
      agencyContext={{
        agencyId: access.agencyId,
        agencyName: access.agencyName,
        assignableAgents,
        canPublishListings: access.canPublishListings,
        initialAssignedAgentIds: currentUserAssignable ? [session.user.id] : undefined,
        returnPath: `${access.basePath}/listings`,
      }}
      duplicateListingId={query.duplicateListing}
      listingError={query.listingError}
      listingStrengthBenchmark={listingStrengthBenchmark}
      profilePath={`/users/${user.username}`}
      publishedListingId={query.listingPublished}
    />
  );
}
