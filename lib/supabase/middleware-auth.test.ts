import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { updateSession } from "./middleware";

const { getClaims, getUser } = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims, getUser } }) }));

beforeEach(() => vi.resetAllMocks());

it("can route a verified Flight session using claims without requesting the full Auth user", async () => {
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", role: "authenticated" } }, error: null });
  getUser.mockResolvedValue({ data: { user: null } });

  const request = new NextRequest("https://treuplate.test/premium", { headers: { rsc: "1" } });
  const result = await updateSession(request, new Headers(request.headers), "claims");

  expect(result.user).toEqual({ id: "user-1" });
  expect(getClaims).toHaveBeenCalledOnce();
  expect(getUser).not.toHaveBeenCalled();
});
