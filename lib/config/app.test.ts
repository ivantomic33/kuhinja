import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, it, vi } from "vitest";
import { tokens } from "@/lib/design/tokens";
import { AuthShell } from "@/components/auth/AuthShell";
import { LogoMark } from "@/components/brand/LogoMark";
import { AppShell } from "@/components/layout/AppShell";
import { AppQueryProvider } from "@/lib/query/provider";
import manifest from "@/public/manifest.json";
import { DEFAULT_DESCRIPTION } from "@/lib/seo/site";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "./app";
import icons from "./pwa-icons.json";

const defaultTitle = "TreuPlate: kalkulator troška porcije za kuhinju";

vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "", variable: "" }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

let layout: typeof import("@/app/layout");
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://treuplate.example");
  try {
    layout = await import("@/app/layout");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("uses the same brand in the title, Open Graph, and PWA manifest", async () => {
  const { metadata, viewport } = layout;
  expect(APP_NAME).toBe("TreuPlate");
  expect(metadata.title).toEqual({ default: defaultTitle, template: `%s | ${APP_NAME}` });
  expect(metadata.description).toBe(DEFAULT_DESCRIPTION);
  expect(APP_DESCRIPTION.length).toBeGreaterThanOrEqual(150);
  expect(APP_DESCRIPTION.length).toBeLessThanOrEqual(160);
  expect(metadata.metadataBase?.origin).toBe("https://treuplate.example");
  expect(metadata.keywords).toBeUndefined();
  expect(metadata.openGraph).toMatchObject({
    siteName: APP_NAME,
    title: defaultTitle,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  });
  expect(manifest).toMatchObject({
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    lang: "sr",
    start_url: "/dashboard",
    display: "standalone",
  });
  expect(viewport.themeColor).toBe(manifest.theme_color);
  expect(renderToStaticMarkup(await layout.default({ children: null }))).toMatch(/^<html lang="sr"/);
});

it("renders the configured name in the sidebar, mobile header, and authentication layout", () => {
  const shell = renderToStaticMarkup(jsx(AppQueryProvider, {
    children: jsx(AppShell, { displayName: "Test user", children: null }),
  }));
  expect(shell.match(/<div\b[^>]*role="complementary"[^>]*>[\s\S]*?(?=<nav\b)/)?.[0]).toContain(`>${APP_NAME}</span>`);
  expect(shell.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0]).toContain(`>${APP_NAME}</p>`);

  const auth = renderToStaticMarkup(jsx(AuthShell, { title: "Prijava", children: null }));
  expect(auth).toContain(`>${APP_NAME}</span>`);
  expect(auth).toContain("max-w-[420px]");
  expect(auth).toMatch(/href="\/premium"[^>]*>Cene i paketi<\/a>/);
});

it("uses the same versioned icon files in the manifest and page metadata", () => {
  expect([...new Set(manifest.icons.map(({ src }) => src))]).toEqual([icons.png192, icons.png512]);
  expect(layout.metadata.icons).toMatchObject({
    icon: [{ url: icons.svg }, { url: icons.png192 }, { url: icons.png512 }],
    apple: [{ url: icons.png192 }],
  });
  for (const url of Object.values(icons)) {
    expect(url).toMatch(/-v\d+\.(?:svg|png)$/);
    expect(existsSync(join(process.cwd(), "public", url))).toBe(true);
  }
});

it("uses the same brand geometry in the favicon and inline logo", () => {
  const logo = readFileSync(join(process.cwd(), "components/brand/treuplate.svg"), "utf8");
  const favicon = readFileSync(join(process.cwd(), "public", icons.svg), "utf8");
  const inline = renderToStaticMarkup(jsx(LogoMark, { title: APP_NAME }));
  expect(logo).toBe(favicon);
  const path = logo.match(/<path[^>]* d="([^"]+)"/)?.[1];
  expect(path).toBeTruthy();
  expect(inline).toContain(`d="${path}"`);
  expect(inline).toContain(`fill="${tokens.accent.toUpperCase()}"`);
  expect(inline).toContain(`fill="${tokens.bg.toUpperCase()}"`);
});
