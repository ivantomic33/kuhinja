import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/ingredients",
        "/recipes",
        "/settings",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
