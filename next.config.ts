import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Tree-shake icon/motion entry points instead of pulling full packages.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

// @serwist/next only supports Webpack and always attaches a webpack hook.
// `next dev --turbopack` warns when that hook exists without a turbopack
// config. The service worker is unused in development, so skip the wrapper
// there. Production `next build` still uses Webpack and generates it.
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) return nextConfig;

  return withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: false,
    cacheOnNavigation: true,
    reloadOnOnline: false,
    register: true,
    globPublicPatterns: ["**/*"],
  })(nextConfig);
}
