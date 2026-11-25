import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { getSiteUrl } from "./lib/config/env";
import icons from "./lib/config/pwa-icons.json";
import { SECURITY_HEADERS } from "./lib/security/csp";

const iconUrls = Object.values(icons);
const offlineEntrypoints = ["main-app", "app/layout", "app/~offline/page"];
const privatePrefixes = ["dashboard", "settings", "ingredients", "recipes", "scaler", "shift", "trebovanje", "raspored", "premium/upravljanje"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Tree-shake icon/motion entry points instead of pulling full packages.
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // Allow Server Actions from local dev and VS Code / GitHub HTTPS tunnels.
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "*.euw.devtunnels.ms",
        "*.devtunnels.ms",
      ],
    },
  },
  async redirects() {
    return [{ source: "/podesavanja", destination: "/settings", permanent: false }];
  },
  async headers() {
    return [
      // Baseline browser hardening for every path (including sw.js / manifest).
      // CSP-Report-Only is set in middleware.ts with a per-request nonce —
      // a static CSP here cannot safely nonce Next.js inline scripts.
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
      ...[...privatePrefixes, "r"].map((prefix) => ({
        source: `/${prefix}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      ...iconUrls.map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      })),
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      // Authenticated app shells must never be stored by browsers or shared CDNs.
      {
        source: "/dashboard",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/settings",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/settings/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/ingredients",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/ingredients/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/recipes",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/recipes/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/scaler",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/scaler/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/shift",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/shift/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/premium",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/premium/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/trebovanje",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/trebovanje/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/raspored",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/raspored/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
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
export default async function config(phase: string): Promise<NextConfig> {
  const productionBuild = phase === PHASE_PRODUCTION_BUILD;
  if (productionBuild) getSiteUrl();
  if (phase === PHASE_DEVELOPMENT_SERVER) return nextConfig;

  let buildId: string;
  const serwistConfig = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: false,
    // IMPORTANT: keep false. cacheOnNavigation would store authenticated HTML
    // navigations (next/link) in Cache Storage. Kitchen tablets are shared, so
    // the next user must never receive user A's shell from the SW cache.
    // Offline for signed-in pages is handled via IndexedDB domain cache + the
    // /~offline document fallback — not by caching app HTML.
    cacheOnNavigation: false,
    reloadOnOnline: false,
    register: true,
    globPublicPatterns: ["manifest.json", ...iconUrls.map((url) => url.slice(1))],
    exclude: [
      ({ asset, compilation }) =>
        // Next marks the Inter subsets preloaded by the root layout with .p.
        !/^static\/media\/[^/]+\.p\.woff2$/.test(asset.name) &&
        !offlineEntrypoints.some((name) => compilation.entrypoints.get(name)?.getFiles().includes(asset.name)),
    ],
    manifestTransforms: [
      (entries) => ({
        manifest: [...entries, { url: "/~offline", revision: buildId, size: 0 }],
        warnings: [],
      }),
    ],
  })({
    ...nextConfig,
    webpack(config, options) {
      buildId = options.buildId;
      return config;
    },
  });
  if (!productionBuild || process.env.ANALYZE !== "true") return serwistConfig;

  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  return bundleAnalyzer({ analyzerMode: "json", openAnalyzer: false })(serwistConfig);
}
