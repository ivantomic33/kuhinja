import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { APP_RUNTIME_CACHE_NAMES } from "@/lib/pwa/cache-names";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Authenticated app routes. Never cache HTML, RSC, or data for these —
 * kitchen tablets are shared and must not leak the previous user's pages.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/ingredients",
  "/recipes",
  "/scaler",
  "/shift",
  "/premium/upravljanje",
  "/trebovanje",
  "/raspored",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSupabaseHost(hostname: string): boolean {
  return (
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.in") ||
    hostname.includes("supabase")
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Navigation preload can race with auth cookies on shared devices.
  navigationPreload: false,
  runtimeCaching: [
    // 1) Protected app routes — never cache (HTML, RSC, prefetch, etc.)
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && isProtectedPath(url.pathname),
      handler: new NetworkOnly(),
    },
    // 2) Public share links and schedule tokens — network only
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/r/"),
      handler: new NetworkOnly(),
    },
    // 3) Same-origin API — never cache user data
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // 4) Auth callback / session routes
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin &&
        (url.pathname.startsWith("/auth/") ||
          url.pathname === "/login" ||
          url.pathname === "/register" ||
          url.pathname === "/forgot-password" ||
          url.pathname === "/reset-password"),
      handler: new NetworkOnly(),
    },
    // 5) Supabase REST / Auth / Functions / Realtime — never cache in Cache Storage.
    // Offline reads go through user-prefixed IndexedDB (lib/offline/cache.ts).
    {
      matcher: ({ url }) => isSupabaseHost(url.hostname),
      handler: new NetworkOnly(),
    },
    // 6) Any cross-origin request (APIs, JSON) — never cache user payloads
    {
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    // 7) Next static build assets only
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: APP_RUNTIME_CACHE_NAMES[0],
        plugins: [
          new ExpirationPlugin({
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 30,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 8) Fonts — StaleWhileRevalidate
    {
      matcher: ({ request, url, sameOrigin }) =>
        request.destination === "font" ||
        (sameOrigin && /\.(?:woff2?|ttf|otf|eot)$/i.test(url.pathname)),
      handler: new StaleWhileRevalidate({
        cacheName: APP_RUNTIME_CACHE_NAMES[1],
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 365,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 9) Images (public marketing / icons content only — not user uploads)
    {
      matcher: ({ request, sameOrigin, url }) =>
        request.destination === "image" ||
        (sameOrigin &&
          /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(url.pathname)),
      handler: new StaleWhileRevalidate({
        cacheName: APP_RUNTIME_CACHE_NAMES[2],
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 10) App icons + manifest (no user data)
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin &&
        (url.pathname.startsWith("/icons/") ||
          url.pathname === "/manifest.json" ||
          url.pathname === "/favicon.ico"),
      handler: new StaleWhileRevalidate({
        cacheName: APP_RUNTIME_CACHE_NAMES[3],
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 11) Public HTML navigations — NetworkFirst with short timeout, then offline fallback
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        !isProtectedPath(url.pathname),
      handler: new NetworkFirst({
        cacheName: APP_RUNTIME_CACHE_NAMES[4],
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 12) Everything else — network only (no private API leakage into Cache Storage)
    {
      matcher: /.*/i,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
