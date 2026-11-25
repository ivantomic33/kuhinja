import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { PATCH } from "@/app/api/versioned-update/route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const maybeSingle = vi.fn();
const eq = vi.fn();
const update = vi.fn();
const from = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockReturnValue({ eq, select: () => ({ maybeSingle }) });
  update.mockReturnValue({ eq });
  from.mockReturnValue({ update });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

function patch(resource: string, input: unknown) {
  return PATCH(new Request("http://localhost/api/versioned-update", {
    method: "PATCH",
    body: JSON.stringify({ resource, input }),
  }));
}

it.each(["ingredients", "recipes"])("returns HTTP 409 for a stale %s update", async (resource) => {
  maybeSingle.mockResolvedValue({ data: null, error: null });
  const response = await patch(resource, { id, version: 3, patch: { name: "Novo" } });
  expect(from).toHaveBeenCalledWith(resource);
  expect(eq.mock.calls).toEqual([["id", id], ["version", 3]]);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: {
      code: "VERSION_CONFLICT",
      message: "Podaci su promenjeni na drugom uređaju",
      status: 409,
    },
  });
});

it("rejects a version embedded in the patch before making a database write", async () => {
  const response = await patch("recipes", { id, version: 3, patch: { version: 5 } });
  expect(response.status).toBe(400);
  expect(from).not.toHaveBeenCalled();
});

it("returns the version supplied by the database", async () => {
  maybeSingle.mockResolvedValue({
    data: { id, name: "Novo", portions: 2, selling_price: 10, version: 4 },
    error: null,
  });
  const response = await patch("recipes", { id, version: 3, patch: { name: "Novo" } });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { id, version: 4 } });
});
