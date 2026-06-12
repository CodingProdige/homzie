import { ImageResponse } from "next/og";
import { getStoredSeoSettings } from "@/modules/seo/settings";

export const alt = "Homzie";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default async function Image() {
  const seo = await getStoredSeoSettings();

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f8f7ff",
          color: "#151221",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: 72,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ color: "#6d3cff", fontSize: 38, fontWeight: 900 }}>
            {seo.organizationName}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.04 }}>
            {seo.defaultOgHeadline}
          </div>
          <div style={{ color: "#5b5868", fontSize: 30, fontWeight: 700 }}>
            {seo.defaultOgSubtitle}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
