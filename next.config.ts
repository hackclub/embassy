import path from "node:path";
import type { NextConfig } from "next";

// Security headers (CSP, X-Frame-Options, etc.) are owned by Caddy in
// production — see infra/nix/services.nix. Do not re-add them here; they
// would be applied twice.
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
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

export default nextConfig;
