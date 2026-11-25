import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";
import { PUBLIC_LEGAL_PAGES } from "@/lib/legal/versions";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteUrl();
  const pages = [
    { path: "/", lastUpdated: "2026-11-25" },
    { path: "/premium", lastUpdated: "2026-11-24" },
    ...PUBLIC_LEGAL_PAGES,
  ];
  return pages.map(({ path, lastUpdated }) => ({
    url: new URL(path, origin).href,
    lastModified: lastUpdated,
  }));
}
