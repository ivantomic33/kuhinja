import { beforeEach, expect, it, vi } from "vitest";
import { updateProfileAction } from "./profile-actions";

const getUser = vi.fn();
const from = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser },
    from,
  }),
}));

beforeEach(() => {
  getUser.mockReset();
  from.mockReset();
  updateUser.mockReset();
});

it("returns UNAUTHORIZED when there is no verified user", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });

  const result = await updateProfileAction({ full_name: "Ana" });

  expect(result).toEqual({
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  });
  expect(from).not.toHaveBeenCalled();
});

it("rejects unknown fields and empty names", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });

  const unknown = await updateProfileAction({
    full_name: "Ana",
    role: "admin",
  });
  expect(unknown).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });

  const empty = await updateProfileAction({ full_name: "   " });
  expect(empty).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
  expect(from).not.toHaveBeenCalled();
});

it("updates only the authenticated user's profile row", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });

  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  from.mockReturnValue({ update });
  updateUser.mockResolvedValue({ error: null });

  const result = await updateProfileAction({ full_name: "Ana Chef" });

  expect(result).toEqual({ data: { full_name: "Ana Chef" } });
  expect(from).toHaveBeenCalledWith("profiles");
  expect(update).toHaveBeenCalledWith({ full_name: "Ana Chef" });
  expect(eq).toHaveBeenCalledWith("id", "user-1");
  expect(updateUser).toHaveBeenCalledWith({
    data: { full_name: "Ana Chef" },
  });
});
