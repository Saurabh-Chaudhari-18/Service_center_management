import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "servicehub-backend.onrender.com",
        pathname: "/media/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry source-map upload — only runs during `next build`.
  // Requires SENTRY_AUTH_TOKEN in the build environment.
  // Leave silent: true so the build log stays clean when the token is absent.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
