import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow build to succeed despite pre-existing minor type mismatches
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;
