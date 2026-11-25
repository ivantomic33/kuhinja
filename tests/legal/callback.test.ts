import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";

const { exchangeCodeForSession, updateUser, signOut, from, upsert } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), from: vi.fn(), upsert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, updateUser, signOut }, from }),
}));

const acceptedAt = "2026-11-24T10:00:00.000Z";
const request = new NextRequest("https://treuplate.test/auth/callback?code=valid-code&next=/login");

beforeEach(() => {
  vi.resetAllMocks();
  exchangeCodeForSession.mockResolvedValue({ data: { user: {
    id: "verified-user", app_metadata: { provider: "email" },
    user_metadata: { legal_consent: { terms: "terms-at-signup", privacy: "privacy-at-signup", acceptedAt } },
  } }, error: null });
  const select = { eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "venue" } }) }) }) };
  from.mockImplementation((table) => table === "legal_consents" ? { upsert } : { select: () => select });
  upsert.mockResolvedValue({ error: null });
});

it("records the versions and time from signup under the verified callback user", async () => {
  const response = await GET(request);
  expect(response.headers.get("location")).toBe("https://treuplate.test/dashboard");
  expect(upsert.mock.calls[0]?.[0]).toEqual([
    { user_id: "verified-user", document: "terms", version: "terms-at-signup", accepted_at: acceptedAt },
    { user_id: "verified-user", document: "privacy", version: "privacy-at-signup", accepted_at: acceptedAt },
  ]);
});

it("returns to login for retry if the authenticated insert fails", async () => {
  upsert.mockResolvedValue({ error: { code: "42501" } });
  expect((await GET(request)).headers.get("location")).toBe("https://treuplate.test/login?consent=retry");
  expect(signOut).toHaveBeenCalledOnce();
  expect(updateUser).not.toHaveBeenCalled();
});

it("keeps the password recovery session available when the consent store is unavailable", async () => {
  upsert.mockResolvedValue({ error: { code: "42501" } });
  const recovery = new NextRequest("https://treuplate.test/auth/callback?code=valid-code&next=/reset-password");
  expect((await GET(recovery)).headers.get("location")).toBe("https://treuplate.test/reset-password");
  expect(signOut).not.toHaveBeenCalled();
});
