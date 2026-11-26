/**
 * Public site origin and default SEO copy.
 * NEXT_PUBLIC_SITE_URL should be an absolute HTTP(S) origin without a trailing slash.
 * Missing or invalid values fall back to local dev — never throw.
 */

export const SITE_NAME = "TreuPlate";

/** Product blurb: ingredients, recipes, purchase prices, stock, shifts, portion cost. */
export const DEFAULT_DESCRIPTION =
  "TreuPlate prati sastojke, recepte, nabavne cene, zalihe i smene i računa trošak porcije.";

const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * Absolute public origin without a trailing slash.
 * Prefer this helper when env may change (tests); SITE_URL is the same value at import time.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK_SITE_URL;

  try {
    const normalized = raw.replace(/\/+$/, "");
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return FALLBACK_SITE_URL;
    }
    if (url.username || url.password || url.search || url.hash) {
      return FALLBACK_SITE_URL;
    }
    // Origin only — reject paths like https://example.com/app
    if (url.pathname !== "/" && url.pathname !== "") {
      return FALLBACK_SITE_URL;
    }
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

/** Absolute public origin without a trailing slash. */
export const SITE_URL = getSiteUrl();
