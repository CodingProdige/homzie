import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    categories: ["lifestyle", "shopping"],
    description: "Find it. Love it. Live it.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/favicon/web-app-manifest-192x192.png",
        type: "image/png",
        purpose: "any",
      },
      {
        sizes: "192x192",
        src: "/favicon/web-app-manifest-192x192.png",
        type: "image/png",
        purpose: "maskable",
      },
      {
        sizes: "512x512",
        src: "/favicon/web-app-manifest-512x512.png",
        type: "image/png",
        purpose: "any",
      },
      {
        sizes: "512x512",
        src: "/favicon/web-app-manifest-512x512.png",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    id: "/",
    name: "Homzie",
    scope: "/",
    short_name: "Homzie",
    start_url: "/",
    theme_color: "#7c5cff",
  };
}
