import { sr } from "@/lib/i18n/sr";

export const socialCardSize = { width: 1200, height: 630 };
export const openGraphCard = {
  url: "/opengraph-image",
  alt: sr.marketing.ogAlt,
  ...socialCardSize,
};
export const twitterCard = { ...openGraphCard, url: "/twitter-image" };
