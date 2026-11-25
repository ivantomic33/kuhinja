import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config/app";
import { openGraphCard, twitterCard } from "./social-card";

export const SITE_TITLE_TEMPLATE = `%s | ${APP_NAME}`;

export function socialMetadata(title: string, description: string, path: string): Metadata {
  return {
    openGraph: {
      type: "website",
      locale: "sr_RS",
      siteName: APP_NAME,
      title,
      description,
      url: path,
      images: [openGraphCard],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterCard],
    },
  };
}

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...socialMetadata(SITE_TITLE_TEMPLATE.replace("%s", title), description, path),
  };
}
