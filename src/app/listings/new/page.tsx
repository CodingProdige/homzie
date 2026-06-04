import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import { CreateListingPage } from "@/modules/listings/components/create-listing-page";

type NewListingPageProps = {
  searchParams?: Promise<{
    duplicateListing?: string;
    listingPublished?: string;
  }>;
};

export default async function NewListingPage({ searchParams }: NewListingPageProps) {
  const session = await getServerSession(authOptions);
  const query = searchParams ? await searchParams : {};

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

  if (!(await hasActiveAgentSubscription(session.user.id))) {
    redirect("/become-agent");
  }

  return (
    <CreateListingPage
      duplicateListingId={query.duplicateListing}
      profilePath={`/users/${user.username}`}
      publishedListingId={query.listingPublished}
    />
  );
}
