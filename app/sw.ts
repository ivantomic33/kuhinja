import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { APP_RUNTIME_CACHE_NAMES, LEGACY_PUBLIC_NAVIGATIONS_CACHE_NAME } from "@/lib/pwa/cache-names";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const PUBLIC_DOCUMENT_PATHS = new Set([
  "/",
  "/kako-poceti",
  "/faq",
  "/pravila-koriscenja",
  "/privatnost",
  "/povracaj-novca",
]);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Navigation preload can race with auth cookies on shared devices.
  navigationPreload: false,
  runtimeCaching: [
    // App APIs and all cross-origin requests, including Supabase, bypass Cache Storage.
    {
      matcher: ({ sameOrigin, url }) =>
        !sameOrigin || url.pathname === "/api" || url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" && PUBLIC_DOCUMENT_PATHS.has(url.pathname),
      handler: new NetworkFirst({
        cacheName: APP_RUNTIME_CACHE_NAMES[4],
        networkTimeoutSeconds: 3,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response.status === 200 && !response.redirected &&
              response.headers.get("content-type")?.startsWith("text/html") &&
              !/(?:^|,)\s*(?:private|no-store)\b/i.test(response.headers.get("cache-control") ?? "")
                ? response
                : null,
          },
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Includes account-aware /premium, checkout, auth forms, and private share links.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
    // Next's hashed build assets also include the self-hosted Inter fonts.
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
    // Public marketing assets. Other images may contain private data.
    {
      matcher: ({ request, url }) =>
        request.destination === "image" &&
        (url.pathname.startsWith("/landing/") || url.pathname === "/opengraph-image" || url.pathname === "/twitter-image"),
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
    // App icons and manifest
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
    // RSC responses and other fetches are network-only by default.
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

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete(LEGACY_PUBLIC_NAVIGATIONS_CACHE_NAME));
});

serwist.addEventListeners();
