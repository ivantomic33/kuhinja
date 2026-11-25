/**
 * Runtime Cache Storage bucket names owned by the TreuPlate service worker.
 * Sign-out must clear these so shared kitchen tablets do not keep prior assets
 * that could be confused with private session state. Precache keys from
 * Serwist/Workbox are matched by prefix in clear-client-state.
 */
export const APP_RUNTIME_CACHE_NAMES = [
  "next-static-assets",
  "static-fonts",
  "static-images",
  "static-icons",
  "public-navigations",
] as const;

/** Prefixes Serwist / Workbox use for build-time precache buckets. */
export const APP_CACHE_PREFIXES = [
  "serwist-precache",
  "workbox-precache",
  "precached-entries",
] as const;

export function isAppCacheName(name: string): boolean {
  if ((APP_RUNTIME_CACHE_NAMES as readonly string[]).includes(name)) return true;
  return APP_CACHE_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}/`),
  );
}
