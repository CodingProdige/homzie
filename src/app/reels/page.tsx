import { getServerSession } from "next-auth";
import { cookies } from "next/headers";

import { authOptions } from "@/modules/auth/config";
import {
  countryPreferenceCookie,
  parseCountryPreference,
} from "@/modules/location/country-preference";
import { ReelsFeed } from "@/modules/reels/components/reels-feed";
import { getRecommendedReels } from "@/modules/reels/server/recommendations";

type ReelsPageProps = {
  searchParams?: Promise<{
    reel?: string;
  }>;
};

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id || null;
  const query = searchParams ? await searchParams : {};
  const preferredReelId =
    typeof query.reel === "string" && query.reel.trim() ? query.reel.trim() : null;
  const cookieStore = await cookies();
  const countryPreference = parseCountryPreference(
    cookieStore.get(countryPreferenceCookie)?.value,
  );
  const rankedFeedReels = await getRecommendedReels({
    countryPreference,
    preferredReelId,
    viewerUserId: viewerId,
  });

  return (
    <ReelsFeed
      preferredReelId={preferredReelId}
      reels={rankedFeedReels}
      scope="global"
    />
  );
}
