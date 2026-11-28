import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/auth/routes";
import { getSiteUrl } from "@/lib/seo/site";

/**
 * /premium stays allowed: it is the public pricing page.
 * /premium/ blocks only signed-in children. Other protected prefixes are
 * disallowed. Login redirects for unlisted private routes remain crawlable
 * so a crawler can read noindex.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
