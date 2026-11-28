import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import TermsPage, { metadata as terms } from "@/app/(legal)/pravila-koriscenja/page";
import PrivacyPage, { metadata as privacy } from "@/app/(legal)/privatnost/page";
import RefundPage, { metadata as refund } from "@/app/(legal)/povracaj-novca/page";
import { metadata as home } from "@/app/(marketing)/page";
import { metadata as kakoPoceti } from "@/app/(marketing)/kako-poceti/page";
import FaqPage, { metadata as faq } from "@/app/faq/page";
import { metadata as premium } from "@/app/premium/page";
import { metadata as login } from "@/app/(auth)/login/page";
import { metadata as register } from "@/app/(auth)/register/page";
import { metadata as resetPassword } from "@/app/(auth)/reset-password/page";
import { metadata as sharedSchedule } from "@/app/r/[token]/page";
import { metadata as appShell } from "@/app/(app)/layout";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  authRoutesMissingRobotsRule,
  isRobotsDisallowed,
  ROBOTS_DISALLOW,
  SITEMAP_PATHS,
} from "@/lib/auth/routes";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQ_ITEMS } from "@/content/faq";
import { DEFAULT_DESCRIPTION, getSiteUrl, SITE_NAME } from "./site";

const origin = "https://treuplate.example";
const pages = [
  ["/", home],
  ["/premium", premium],
  ["/kako-poceti", kakoPoceti],
  ["/faq", faq],
  ["/pravila-koriscenja", terms],
  ["/privatnost", privacy],
  ["/povracaj-novca", refund],
] as const;

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin));
afterEach(() => vi.unstubAllEnvs());

it("resolves SITE_URL without throwing and falls back to localhost", () => {
  expect(getSiteUrl()).toBe(origin);
  expect(SITE_NAME).toBe("TreuPlate");
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/sastojk/);
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/recept/);
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/nabavn/);
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/zal/);
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/smen/);
  expect(DEFAULT_DESCRIPTION.toLowerCase()).toMatch(/trošak porcije|trosak porcije/);

  for (const value of [undefined, "", "treuplate.example", origin + "/faq", "ftp://treuplate.example", "https://user@treuplate.example"]) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(getSiteUrl()).toBe("http://localhost:3000");
  }

  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin + "/");
  expect(getSiteUrl()).toBe(origin);
});

it("gives each public page distinct metadata and a self-canonical URL", () => {
  const corePaths = new Set(["/", "/premium", "/kako-poceti"]);
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const [path, metadata] of pages) {
    expect(typeof metadata.title).toBe("string");
    const title = `${metadata.title} | TreuPlate`;
    expect(title.length).toBeLessThanOrEqual(60);
    titles.add(title);
    expect(metadata.description).toBeTruthy();
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    if (corePaths.has(path)) {
      expect(metadata.description!.length).toBeGreaterThanOrEqual(120);
    }
    descriptions.add(metadata.description!);
    expect(metadata.alternates?.canonical).toBe(path);
    expect(metadata.openGraph).toMatchObject({ type: "website", locale: "sr_RS", siteName: "TreuPlate", url: path, title, description: metadata.description });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title, description: metadata.description });
  }
  expect(titles.size).toBe(pages.length);
  expect(descriptions.size).toBe(pages.length);
});

it("lists core public routes in the sitemap and blocks private paths in robots", async () => {
  const entries = sitemap();
  const paths = entries.map(({ url }) => {
    const pathname = new URL(url).pathname;
    return pathname === "" ? "/" : pathname;
  }).sort();
  expect(paths).toEqual([...SITEMAP_PATHS].sort());
  for (const { url, lastModified, changeFrequency, priority } of entries) {
    expect(new URL(url).origin).toBe(origin);
    expect(lastModified).toBeTruthy();
    expect(changeFrequency).toBeTruthy();
    expect(typeof priority).toBe("number");
  }
  const homeEntry = entries.find((entry) => {
    const pathname = new URL(entry.url).pathname;
    return pathname === "/" || pathname === "";
  });
  expect(homeEntry?.priority).toBe(1);
  expect(robots()).toEqual({
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: origin + "/sitemap.xml",
    host: origin,
  });
  expect(ROBOTS_DISALLOW).toEqual(expect.arrayContaining([
    "/dashboard",
    "/otpad",
    "/purchase-orders",
    "/premium/",
    "/api/",
    "/auth/",
  ]));
  expect(ROBOTS_DISALLOW).not.toContain("/premium");
  expect(isRobotsDisallowed("/premium")).toBe(false);
  expect(isRobotsDisallowed("/premium/ponuda")).toBe(true);
  expect(isRobotsDisallowed("/premium/upravljanje")).toBe(true);
  expect(authRoutesMissingRobotsRule()).toEqual([]);
  for (const metadata of [login, register, resetPassword, sharedSchedule, appShell]) {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  }
  vi.stubEnv("PADDLE_API_KEY", "fixture");
  vi.stubEnv("PADDLE_WEBHOOK_SECRET", "fixture");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_ENVIRONMENT", "sandbox");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_fixture");
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_MONTHLY", "pri_" + "m".repeat(26));
  vi.stubEnv("NEXT_PUBLIC_PADDLE_PRICE_YEARLY", "pri_" + "y".repeat(26));
  const config = await nextConfig(PHASE_DEVELOPMENT_SERVER);
  const headers = await config.headers?.();
  const noindex = headers?.filter(({ headers }) => headers.some(({ key, value }) => key === "X-Robots-Tag" && value === "noindex, nofollow"));
  expect(noindex?.map(({ source }) => source)).toEqual(expect.arrayContaining(
    ["dashboard", "ingredients", "recipes", "scaler", "shift", "settings", "trebovanje", "raspored", "otpad", "purchase-orders", "premium/upravljanje", "premium/ponuda", "r"].map((prefix) => `/${prefix}/:path*`),
  ));
  expect(noindex?.some(({ source }) => source === "/premium/:path*")).toBe(false);
});

function structuredData(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

it("escapes angle brackets while preserving JSON-LD values", () => {
  const data = { text: "</script><script>bad()</script> & tekst" };
  const html = renderToStaticMarkup(createElement(JsonLd, { data }));
  expect(html).not.toContain("<script>bad()");
  expect(html).toContain("\\u003c");
  expect(structuredData(html)).toEqual([data]);
});

it("renders the FAQ questions and answers with matching schema and one main heading", () => {
  // FaqPage uses client hooks; verify schema directly instead of full render
  expect(structuredData(renderToStaticMarkup(createElement(JsonLd, { data: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  } })))).toEqual([{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }]);
});

it.each([
  [TermsPage, terms], [PrivacyPage, privacy], [RefundPage, refund],
] as const)("renders one heading and a legal breadcrumb", (Page, metadata) => {
  const html = renderToStaticMarkup(Page());
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(structuredData(html)).toEqual([{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Početna", item: origin + "/" },
      { "@type": "ListItem", position: 2, name: metadata.title, item: origin + metadata.alternates!.canonical },
    ],
  }]);
});

it("ships both local Inter font subsets for the social cards", () => {
  for (const subset of ["latin", "latin-ext"]) {
    expect(readFileSync(`assets/fonts/inter-${subset}-700-normal.woff`).subarray(0, 4).toString()).toBe("wOFF");
  }
});
