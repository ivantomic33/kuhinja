import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { classifyRoute, isAuthEntryPath, isPublicPath } from "./routes";

const APP_ROOT = path.resolve(process.cwd(), "app");

function collectPageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPageFiles(full, acc);
    else if (entry.name === "page.tsx" || entry.name === "page.ts") acc.push(full);
  }
  return acc;
}

function fileToRoute(file: string): string {
  const rel = path.relative(APP_ROOT, file).replaceAll("\\", "/");
  const withoutPage = rel.replace(/\/page\.tsx?$/, "");
  const parts = withoutPage.split("/").filter((segment) => segment.length > 0 && !/^\(.*\)$/.test(segment));
  return `/${parts.join("/")}`;
}

it("classifies every app/ page.tsx route as public, guest, or auth", () => {
  const routes = collectPageFiles(APP_ROOT).map(fileToRoute);
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes) {
    expect(classifyRoute(route), `${route} is missing from lib/auth/routes.ts`).not.toBeNull();
  }
});

it("treats /trebovanje and /raspored as authenticated workspace pages", () => {
  expect(classifyRoute("/trebovanje")).toBe("auth");
  expect(classifyRoute("/raspored")).toBe("auth");
  expect(isPublicPath("/trebovanje")).toBe(false);
  expect(isPublicPath("/raspored")).toBe(false);
});

it("sends signed-in users away from guest auth entry pages", () => {
  expect(isAuthEntryPath("/login")).toBe(true);
  expect(isAuthEntryPath("/register")).toBe(true);
  expect(isAuthEntryPath("/forgot-password")).toBe(true);
  expect(isPublicPath("/login")).toBe(true);
});
