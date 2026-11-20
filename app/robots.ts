import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/recipes",
        "/ingredients",
        "/settings",
        "/premium",
        "/shift",
        "/scaler",
        "/trebovanje",
        "/raspored",
        "/r/",
        "/forgot-password",
        "/reset-password",
        "/auth/",
        "/~offline",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
