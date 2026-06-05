import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    description: "Find it. Love it. Live it.",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    name: "Homzie",
    short_name: "Homzie",
    start_url: "/",
    theme_color: "#7c5cff",
  };
}
