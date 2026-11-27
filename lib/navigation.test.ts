import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/layout/BottomNav";
import { SidebarNav } from "@/components/layout/SidebarNav";

const state = vi.hoisted(() => ({ pathname: "/dashboard", moreOpen: false }));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: boolean) => react.useState(initial || state.moreOpen) };
});
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/lib/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/pwa/OfflineIndicator", () => ({ OfflineIndicator: () => null }));
vi.mock("@/components/layout/ProfileMenu", () => ({ ProfileMenu: () => null }));
vi.mock("@/components/ui/BottomSheet", () => ({
  BottomSheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? createElement("div", { role: "dialog", "aria-label": title }, children) : null,
}));

const kitchenRoutes = ["/dashboard", "/recipes", "/ingredients", "/raspored", "/shift", "/trebovanje", "/purchase-orders", "/scaler"];
const accountRoutes = ["/premium", "/settings"];
const activeHref = (html: string) =>
  html.match(/<a\b[^>]*aria-current="page"[^>]*>/g)?.map((tag) => tag.match(/href="([^"]+)"/)?.[1]) ?? [];

beforeEach(() => {
  state.pathname = "/dashboard";
  state.moreOpen = false;
});

it("groups the kitchen and account links on desktop and keeps the extra destinations in the mobile dialog", () => {
  const sidebar = renderToStaticMarkup(createElement(SidebarNav));
  const linksInGroup = (label: string) => sidebar
    .match(new RegExp(`role="group" aria-label="${label}"[^>]*>(.*?)<\\/div>`))?.[1]
    .match(/href="[^"]+"/g)?.map(href => href.slice(6, -1));
  expect(linksInGroup("Kuhinja")).toEqual(kitchenRoutes);
  expect(linksInGroup("Račun")).toEqual(accountRoutes);

  state.moreOpen = true;
  const mobile = renderToStaticMarkup(createElement(BottomNav));
  const dialog = mobile.match(/role="dialog" aria-label="Više"[^>]*>(.*?)<\/div>/)?.[1];
  expect(dialog).toBeDefined();
  for (const href of [...kitchenRoutes.slice(3), "/premium"]) {
    expect(dialog).toContain(`href="${href}"`);
  }
});

it("labels the settings tab and marks Više current on a nested schedule route", () => {
  state.pathname = "/raspored/raspored-123";
  const html = renderToStaticMarkup(createElement(BottomNav));
  expect(html).toMatch(/<a[^>]*href="\/settings"[^>]*>.*?>Podešavanja<\/span><\/a>/);
  expect(html).toMatch(/<button[^>]*aria-current="location"[^>]*>.*?>Više<\/span><\/button>/);
});

it.each([
  ["/recipes/123", ["/recipes"]],
  ["/settings/billing", ["/settings"]],
  ["/scaler/123", ["/scaler"]],
  ["/shift/123", ["/shift"]],
  ["/trebovanje", ["/trebovanje"]],
  ["/raspored", ["/raspored"]],
  ["/premium", ["/premium"]],
  ["/recipes-old/123", []],
])("shows the expected active link at %s", (pathname, expected) => {
  state.pathname = pathname;
  state.moreOpen = true;
  expect(activeHref(renderToStaticMarkup(createElement(SidebarNav)))).toEqual(expected);
  expect(activeHref(renderToStaticMarkup(createElement(BottomNav)))).toEqual(expected);
});
