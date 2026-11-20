const DEFAULT_SITE_URL = "https://mise.app";

/** Public origin used for canonical, Open Graph, robots, and sitemap URLs. */
export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}
