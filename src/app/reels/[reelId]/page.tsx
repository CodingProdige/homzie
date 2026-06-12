import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { reels, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  countryPreferenceCookie,
  parseCountryPreference,
} from "@/modules/location/country-preference";
import { ReelsFeed } from "@/modules/reels/components/reels-feed";
import { getRecommendedReels } from "@/modules/reels/server/recommendations";
import { buildReelPath } from "@/modules/reels/urls";
import { absoluteUrl } from "@/modules/site/url";

type ReelPageProps = {
  params: Promise<{
    reelId: string;
  }>;
};

async function getPublicReel(reelId: string) {
  const [reel] = await db
    .select({
      caption: reels.caption,
      createdAt: reels.createdAt,
      id: reels.id,
      updatedAt: reels.updatedAt,
      username: users.username,
    })
    .from(reels)
    .innerJoin(users, eq(users.id, reels.userId))
    .where(
      and(
        eq(reels.id, reelId),
        eq(reels.status, "published"),
        eq(users.status, "active"),
        eq(users.profileVisible, true),
      ),
    )
    .limit(1);

  return reel;
}

export async function generateMetadata({
  params,
}: ReelPageProps): Promise<Metadata> {
  const { reelId } = await params;
  const reel = await getPublicReel(reelId);

  if (!reel) {
    return {
      robots: {
        follow: false,
        index: false,
      },
      title: "Reel not found | Homzie",
    };
  }

  const title = reel.caption
    ? `${reel.caption.slice(0, 70)} | Homzie Reel`
    : `@${reel.username || "homzie"}'s Homzie Reel`;
  const description = `Watch this Homzie property reel by @${reel.username || "homzie"}.`;
  const url = absoluteUrl(buildReelPath(reel.id));

  return {
    alternates: {
      canonical: url,
    },
    description,
    openGraph: {
      description,
      title,
      type: "video.other",
      url,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      title,
    },
  };
}

export default async function ReelPage({ params }: ReelPageProps) {
  const { reelId } = await params;
  const [session, publicReel] = await Promise.all([
    getServerSession(authOptions),
    getPublicReel(reelId),
  ]);

  if (!publicReel) {
    notFound();
  }

  const viewerId = session?.user?.id || null;
  const cookieStore = await cookies();
  const countryPreference = parseCountryPreference(
    cookieStore.get(countryPreferenceCookie)?.value,
  );
  const rankedFeedReels = await getRecommendedReels({
    countryPreference,
    preferredReelId: reelId,
    viewerUserId: viewerId,
  });

  return (
    <ReelsFeed
      preferredReelId={reelId}
      reels={rankedFeedReels}
      scope="global"
    />
  );
}
