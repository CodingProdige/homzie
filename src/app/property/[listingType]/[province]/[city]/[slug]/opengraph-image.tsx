import { ImageResponse } from "next/og";

import {
  getListingDetail,
  getListingIdByShortId,
} from "@/modules/listings/server/listing-data";
import {
  buildListingSeoTitle,
  extractShortListingIdFromSlug,
} from "@/modules/listings/seo";

export const alt = "Homzie property listing";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listingId = await getListingIdByShortId(extractShortListingIdFromSlug(slug));
  const listing = listingId
    ? await getListingDetail({ listingId, viewerUserId: null })
    : null;
  const title = listing ? buildListingSeoTitle(listing) : "Property on Homzie";
  const location = listing?.location || listing?.city || "Homzie";
  const price = listing?.priceLabel || "View listing";
  const stats = listing
    ? [
        listing.bedrooms ? `${listing.bedrooms} bed` : "",
        listing.bathrooms ? `${listing.bathrooms} bath` : "",
        listing.garages ? `${listing.garages} garage` : "",
      ]
        .filter(Boolean)
        .join("  |  ")
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#151221",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 64,
          width: "100%",
        }}
      >
        <div style={{ color: "#a894ff", fontSize: 34, fontWeight: 900 }}>
          Homzie Property
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.03 }}>
            {title}
          </div>
          <div style={{ color: "#d9d4ff", fontSize: 32, fontWeight: 800 }}>
            {location}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <div
              style={{
                background: "#6d3cff",
                borderRadius: 18,
                fontSize: 30,
                fontWeight: 900,
                padding: "16px 24px",
              }}
            >
              {price}
            </div>
            {stats ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 18,
                  fontSize: 28,
                  fontWeight: 800,
                  padding: "16px 24px",
                }}
              >
                {stats}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
