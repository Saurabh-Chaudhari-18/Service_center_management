import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  // Django/DRF endpoints are slash-sensitive. Preserve API request paths so
  // POST /api/auth/token/ is not redirected to the non-slash variant.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    }];
  },
  async rewrites() {
    const backendApi = process.env.BACKEND_API_URL
      || (process.env.VERCEL ? "https://servicehub-backend.onrender.com/api" : "");
    return backendApi ? [{
      source: "/api/:path*",
      // DRF uses APPEND_SLASH and cannot redirect POST bodies. Force the
      // backend-facing path to retain its trailing slash.
      destination: `${backendApi}/:path*/`,
    }] : [];
  },
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
  // hideSourceMaps was renamed to sourcemaps.deleteFilesAfterUpload in @sentry/nextjs v10
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
