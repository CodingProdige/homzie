import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeUsername } from "@/modules/auth/username";

export const alt = "Homzie profile";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const normalizedUsername = normalizeUsername(username);
  const [profile] = normalizedUsername
    ? await db
        .select({
          bio: users.bio,
          location: users.location,
          name: users.name,
          username: users.username,
        })
        .from(users)
        .where(
          and(
            eq(users.username, normalizedUsername),
            eq(users.status, "active"),
            eq(users.profileVisible, true),
          ),
        )
        .limit(1)
    : [];
  const title = profile?.name || "Homzie Profile";
  const subtitle = profile?.location || profile?.username || "Property profile";
  const bio = profile?.bio || "View listings, reels and agent details on Homzie.";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f8f7ff",
          color: "#151221",
          display: "flex",
          flexDirection: "column",
          gap: 36,
          height: "100%",
          justifyContent: "center",
          padding: 72,
          width: "100%",
        }}
      >
        <div style={{ color: "#6d3cff", fontSize: 34, fontWeight: 900 }}>
          Homzie Agent Profile
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 78, fontWeight: 900, lineHeight: 1 }}>
            {title}
          </div>
          <div style={{ color: "#6d3cff", fontSize: 34, fontWeight: 800 }}>
            {subtitle}
          </div>
          <div style={{ color: "#5b5868", fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>
            {bio.slice(0, 150)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
