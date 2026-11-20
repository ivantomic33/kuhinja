import { existsSync } from "node:fs";
import { join } from "node:path";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { metadata } from "@/app/layout";
import { AuthShell } from "@/components/auth/AuthShell";
import { AppShell } from "@/components/layout/AppShell";
import { AppQueryProvider } from "@/lib/query/provider";
import manifest from "@/public/manifest.json";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "./app";
import icons from "./pwa-icons.json";

vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "", variable: "" }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

it("uses the same brand in the title, Open Graph, and PWA manifest", () => {
  expect(APP_NAME).toBe("TreuPlate");
  expect(metadata.title).toEqual({ default: APP_NAME, template: `%s · ${APP_NAME}` });
  expect(metadata.openGraph).toMatchObject({ siteName: APP_NAME, description: APP_DESCRIPTION });
  expect(manifest).toMatchObject({
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
  });
});

it("renders the configured name in the sidebar, mobile header, and authentication layout", () => {
  const shell = renderToStaticMarkup(jsx(AppQueryProvider, {
    children: jsx(AppShell, { displayName: "Test user", children: null }),
  }));
  expect(shell.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/)?.[0]).toContain(`>${APP_NAME}</span>`);
  expect(shell.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0]).toContain(`>${APP_NAME}</p>`);

  const auth = renderToStaticMarkup(jsx(AuthShell, { title: "Prijava", children: null }));
  expect(auth).toContain(`>${APP_NAME}</a>`);
  expect(auth).toContain(`>${APP_NAME}</p>`);
});

it("uses the same versioned icon files in the manifest and page metadata", () => {
  expect([...new Set(manifest.icons.map(({ src }) => src))]).toEqual([icons.png192, icons.png512]);
  expect(metadata.icons).toMatchObject({
    icon: [{ url: icons.svg }, { url: icons.png192 }, { url: icons.png512 }],
    apple: [{ url: icons.png192 }],
  });
  for (const url of Object.values(icons)) {
    expect(url).toMatch(/-v\d+\.(?:svg|png)$/);
    expect(existsSync(join(process.cwd(), "public", url))).toBe(true);
  }
});
