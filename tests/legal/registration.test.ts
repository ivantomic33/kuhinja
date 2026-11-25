import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, registerAction } from "@/lib/auth/actions";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

const { signUp, signInWithPassword, signOut, from, upsert, updateUser } = vi.hoisted(() => ({
  signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(),
  from: vi.fn(), upsert: vi.fn(), updateUser: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp, signInWithPassword, signOut, updateUser }, from }),
}));

const input = {
  email: "cook@example.test", password: "test-password", fullName: "Petar", venueName: "Kuhinja",
  acceptTerms: true as const, marketingOptIn: false,
};
const acceptedAt = "2026-11-24T11:03:00.000Z";
const pending = { terms: "previous-terms", privacy: "previous-privacy", acceptedAt };
const user = { id: "user-1", user_metadata: { legal_consent: pending } };

beforeEach(() => {
  vi.resetAllMocks();
  signUp.mockResolvedValue({ data: { user, session: null }, error: null });
  signInWithPassword.mockResolvedValue({ data: { user }, error: null });
  from.mockReturnValue({ upsert });
  upsert.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe("email registration consent", () => {
  it("rejects missing or unchecked consent before calling Auth", async () => {
    for (const acceptTerms of [undefined, false]) {
      const result = await registerAction({ ...input, acceptTerms } as typeof input);
      expect(result).toMatchObject({ success: false, fieldErrors: { acceptTerms: expect.any(String) } });
    }
    expect(signUp).not.toHaveBeenCalled();
  });

  it("sends server versions to signup metadata and waits when there is no session", async () => {
    expect(await registerAction(input)).toMatchObject({ success: true });
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ data: expect.objectContaining({
        legal_consent: {
          terms: LEGAL_VERSIONS.terms.version,
          privacy: LEGAL_VERSIONS.privacy.version,
          acceptedAt: expect.any(String),
        },
      }) }),
    }));
    expect(from).not.toHaveBeenCalled();
  });

  it("stores both mandatory rows and opted-in marketing before signing out an immediate session", async () => {
    signUp.mockResolvedValueOnce({ data: {
      user: { ...user, user_metadata: { legal_consent: { ...pending, marketing: "marketing-version" } } },
      session: {},
    }, error: null });
    expect(await registerAction({ ...input, marketingOptIn: true })).toMatchObject({ success: true });
    expect(from).toHaveBeenCalledWith("legal_consents");
    expect(upsert).toHaveBeenCalledWith([
      { user_id: user.id, document: "terms", version: pending.terms, accepted_at: acceptedAt },
      { user_id: user.id, document: "privacy", version: pending.privacy, accepted_at: acceptedAt },
      { user_id: user.id, document: "marketing", version: "marketing-version", accepted_at: acceptedAt },
    ], { onConflict: "user_id,document,version", ignoreDuplicates: true });
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
  });

  it("retries with the accepted versions on password login and preserves pending metadata when storage fails", async () => {
    upsert.mockResolvedValueOnce({ error: { code: "test-error" } });
    expect(await loginAction(inputForLogin())).toMatchObject({ success: false });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledOnce();
    expect(await loginAction(inputForLogin())).toMatchObject({ success: true });
    expect(upsert.mock.calls[1]).toEqual(upsert.mock.calls[0]);
    expect(updateUser).toHaveBeenCalledWith({ data: { legal_consent: null } });
  });
});

function inputForLogin() {
  return { email: input.email, password: input.password };
}
