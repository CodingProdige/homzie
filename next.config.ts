import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  experimental: {
    proxyClientMaxBodySize: "95mb",
    serverActions: {
      bodySizeLimit: "95mb",
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
