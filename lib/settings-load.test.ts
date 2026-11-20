import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import SettingsPage from "@/app/(app)/settings/page";
import { FREE_MAX_INGREDIENTS, FREE_MAX_RECIPES, FREE_MAX_TEMPLATES } from "@/lib/plan/limits";
import { resolvePlanDetails } from "@/lib/supabase/plan";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getServerUser: async () => ({ id: "settings-user" }),
}));
vi.mock("@/lib/supabase/plan-server", () => ({ getPlanDetails: vi.fn() }));
vi.mock("@/components/settings/SettingsAccountForm", () => ({ SettingsAccountForm: () => null }));
vi.mock("@/components/auth/DeleteAccountButton", () => ({ DeleteAccountButton: () => null }));
vi.mock("@/components/auth/SignOutButton", () => ({ SignOutButton: () => null }));

it.each(["free", "starter", "pro"])("loads only the usage counts displayed on %s", async (plan) => {
  const counts = new Map([
    ["recipes", 2],
    ["ingredients", 7],
    ["checklist_templates", 1],
  ]);
  const requests: string[] = [];
  const supabase = createSupabaseClient("https://settings.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        const table = url.pathname.split("/").at(-1)!;
        requests.push(`${init?.method} ${table}`);
        const count = counts.get(table);
        if (count === undefined) throw new Error(`Unexpected request ${url.pathname}`);
        return new Response(null, { headers: { "content-range": `0-0/${count}` } });
      },
    },
  });
  vi.mocked(createClient).mockResolvedValue(supabase);
  vi.mocked(getPlanDetails).mockResolvedValue(resolvePlanDetails(plan));

  const html = renderToStaticMarkup(await SettingsPage());

  if (plan === "pro") {
    expect(requests).toEqual([]);
    expect(html.match(/Premium: bez limita/g)).toHaveLength(3);
  } else {
    expect(requests.sort()).toEqual(["HEAD checklist_templates", "HEAD ingredients", "HEAD recipes"]);
    expect(html).toContain(`>2 od ${FREE_MAX_RECIPES}<`);
    expect(html).toContain(`>7 od ${FREE_MAX_INGREDIENTS}<`);
    expect(html).toContain(`>1 od ${FREE_MAX_TEMPLATES}<`);
  }
});
