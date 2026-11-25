import { beforeEach, expect, it, vi } from "vitest";
import { recordLegalConsent } from "@/lib/legal/actions";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

const { getUser, from, upsert, inDocuments } = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), upsert: vi.fn(), inDocuments: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const user = { id: "google-user", app_metadata: { provider: "google" } };

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user }, error: null });
  from.mockReturnValue({ select: () => ({ eq: () => ({ in: inDocuments }) }), upsert });
  inDocuments.mockResolvedValue({ data: [], error: null });
  upsert.mockResolvedValue({ error: null });
});

it("validates the checkbox and rejects client-supplied versions", async () => {
  const accepted = { acceptTerms: true as const, marketingOptIn: false };
  const input = { ...accepted, version: "untrusted" };
  expect(await recordLegalConsent(input)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  expect(getUser).not.toHaveBeenCalled();
});

it("writes the active versions as the authenticated Google user", async () => {
  expect(await recordLegalConsent({ acceptTerms: true, marketingOptIn: false })).toEqual({ data: null });
  expect(upsert.mock.calls[0]?.[0]).toEqual([
    { user_id: user.id, document: "terms", version: LEGAL_VERSIONS.terms.version, accepted_at: expect.any(String) },
    { user_id: user.id, document: "privacy", version: LEGAL_VERSIONS.privacy.version, accepted_at: expect.any(String) },
  ]);
});

it("keeps a returning user's original records", async () => {
  inDocuments.mockResolvedValue({ data: [{ document: "terms" }, { document: "privacy" }], error: null });
  expect(await recordLegalConsent({ acceptTerms: true, marketingOptIn: true })).toEqual({ data: null });
  expect(upsert).not.toHaveBeenCalled();
});
