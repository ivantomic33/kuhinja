import { Writable } from "node:stream";
import { createElement, type ReactNode } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import AppLayout from "@/app/(app)/layout";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { resolvePlanDetails } from "@/lib/supabase/plan";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select }) }),
  getServerUser: async () => ({ id: "account-1", email: "cook@example.com" }),
}));
vi.mock("@/lib/supabase/plan-server", () => ({ getPlanDetails: vi.fn() }));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, recipeUsage }: { children: ReactNode; recipeUsage?: ReactNode }) =>
    createElement("main", null, children, recipeUsage),
}));

beforeEach(() => select.mockReset());

it("renders the authenticated page before the free sidebar usage count is available", async () => {
  vi.mocked(getPlanDetails).mockResolvedValue(resolvePlanDetails("free"));
  const count = Promise.withResolvers<{ count: number }>();
  select.mockReturnValue(count.promise);
  let html = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      html += chunk.toString();
      done();
    },
  });

  const rendering = AppLayout({ children: "Page contents" }).then((layout) => {
    const stream = renderToPipeableStream(layout, {
      onShellReady() { stream.pipe(output); },
    });
  });

  try {
    await vi.waitFor(() => expect(html).toContain("Page contents"));
    expect(html.replace(/<!--.*?-->/g, "")).toContain("Recepti — / 5");
    count.resolve({ count: 3 });
    await vi.waitFor(() => expect(html.replace(/<!--.*?-->/g, "")).toContain("Recepti 3 / 5"));
  } finally {
    count.resolve({ count: 3 });
    await rendering;
  }
});

it("skips the sidebar recipe count query when the premium badge replaces it", async () => {
  vi.mocked(getPlanDetails).mockResolvedValue(resolvePlanDetails("pro"));
  select.mockResolvedValue({ count: 5 });

  const layout = await AppLayout({ children: "Page contents" });
  expect(renderToStaticMarkup(layout)).toContain("Page contents");
  expect(select).not.toHaveBeenCalled();
});
