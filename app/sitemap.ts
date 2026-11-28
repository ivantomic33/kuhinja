import type { MetadataRoute } from "next";
import { SITEMAP_PATHS } from "@/lib/auth/routes";
import { LEGAL_LAST_UPDATED, PUBLIC_LEGAL_PAGES } from "@/lib/legal/versions";
import { getSiteUrl } from "@/lib/seo/site";

/** Bump when home, pricing, or the getting-started guide changes. */
const MARKETING_LAST_MODIFIED = "2026-11-24";

const LEGAL_PATHS = new Set<string>(PUBLIC_LEGAL_PAGES.map((page) => page.path));

function lastModifiedFor(path: string): Date {
  const iso = LEGAL_PATHS.has(path) ? LEGAL_LAST_UPDATED : MARKETING_LAST_MODIFIED;
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Public pages that are not auth screens and not protected app prefixes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  return SITEMAP_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: lastModifiedFor(path),
    changeFrequency: path === "/" || path === "/premium" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
