import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import TermsPage, { metadata as terms } from "@/app/(legal)/pravila-koriscenja/page";
import PrivacyPage, { metadata as privacy } from "@/app/(legal)/privatnost/page";
import RefundPage, { metadata as refund } from "@/app/(legal)/povracaj-novca/page";
import { metadata as home } from "@/app/(marketing)/page";
import FaqPage, { metadata as faq } from "@/app/faq/page";
import { metadata as premium } from "@/app/premium/page";
import { metadata as login } from "@/app/(auth)/login/page";
import { metadata as register } from "@/app/(auth)/register/page";
import { metadata as sharedSchedule } from "@/app/r/[token]/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQ_ITEMS } from "@/content/faq";
import { getSiteUrl } from "./site";

const origin = "https://treuplate.example";
const pages = [
  ["/", home],
  ["/premium", premium],
  ["/faq", faq],
  ["/pravila-koriscenja", terms],
  ["/privatnost", privacy],
  ["/povracaj-novca", refund],
] as const;

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin));
afterEach(() => vi.unstubAllEnvs());

it("requires an absolute HTTP(S) origin without the trailing slash", () => {
  expect(getSiteUrl()).toBe(origin);
  for (const value of [undefined, "", "treuplate.example", origin + "/", origin + "/?x=1", origin + "/faq", "ftp://treuplate.example", "https://user@treuplate.example"]) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
    expect(getSiteUrl).toThrow(/NEXT_PUBLIC_SITE_URL/);
  }
});

it("gives each public page distinct metadata and a self-canonical URL", () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const [path, metadata] of pages) {
    expect(typeof metadata.title).toBe("string");
    const title = `${metadata.title} | TreuPlate`;
    expect(title.length).toBeLessThanOrEqual(60);
    titles.add(title);
    expect(metadata.description).toBeTruthy();
    expect(metadata.description!.length).toBeLessThanOrEqual(160);
    descriptions.add(metadata.description!);
    expect(metadata.alternates?.canonical).toBe(path);
    expect(metadata.openGraph).toMatchObject({ type: "website", locale: "sr_RS", siteName: "TreuPlate", url: path, title, description: metadata.description });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title, description: metadata.description });
  }
  expect(titles.size).toBe(pages.length);
  expect(descriptions.size).toBe(pages.length);
});

it("includes only indexable public routes in the sitemap and permits crawling noindex pages", async () => {
  const entries = sitemap();
  expect(entries.map(({ url }) => new URL(url).pathname).sort()).toEqual(pages.map(([path]) => path).sort());
  for (const { url, lastModified } of entries) {
    expect(new URL(url).origin).toBe(origin);
    expect(lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: origin + "/sitemap.xml" });
  for (const metadata of [login, register, sharedSchedule]) {
    expect(metadata.robots).toMatchObject({ index: false });
  }
  const config = await nextConfig(PHASE_DEVELOPMENT_SERVER);
  const headers = await config.headers?.();
  const noindex = headers?.filter(({ headers }) => headers.some(({ key, value }) => key === "X-Robots-Tag" && value === "noindex, nofollow"));
  expect(noindex?.map(({ source }) => source)).toEqual(expect.arrayContaining(
    ["dashboard", "ingredients", "recipes", "scaler", "shift", "settings", "trebovanje", "raspored", "premium/upravljanje", "r"].map((prefix) => `/${prefix}/:path*`),
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
  const html = renderToStaticMarkup(FaqPage());
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html.match(/<main\b/g)).toHaveLength(1);
  expect(structuredData(html)).toEqual([{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }]);
  for (const { question, answer } of FAQ_ITEMS) {
    expect(html).toContain(renderToStaticMarkup(createElement("span", null, question)));
    expect(html).toContain(renderToStaticMarkup(createElement("span", null, answer)).slice(6, -7));
  }
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
