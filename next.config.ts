import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Security headers (CSP, X-Frame-Options, etc.) are owned by Caddy in
// production — see infra/nix/services.nix. Do not re-add them here; they
// would be applied twice.
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.hackclub.com" },
      { protocol: "https", hostname: "*.hackclub-assets.com" }, // cdn and stuff
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

// Source maps are uploaded only when SENTRY_AUTH_TOKEN/ORG/PROJECT are set at
// build time; otherwise this is a passthrough and the build is unaffected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
});
