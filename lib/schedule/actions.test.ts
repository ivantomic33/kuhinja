import { beforeEach, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PLANS } from "@/lib/billing/plans";
import { loadScheduleReport, updateSchedule } from "./actions";

const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const location = "11111111-1111-4111-8111-111111111111";
const week = "2026-03-16";
const otherLocation = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
  vi.mocked(revalidatePath).mockReset();
});

it("returns UNAUTHORIZED when updateSchedule has no verified user", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });

  const result = await updateSchedule(location, week, { type: "publish" });

  expect(result).toEqual({
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  });
  expect(rpc).not.toHaveBeenCalled();
});

it("returns VALIDATION_ERROR for unknown command fields", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });

  const result = await updateSchedule(location, week, {
    type: "publish",
    // @ts-expect-error intentional unknown field
    sneaky: true,
  });

  expect(result).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
  expect(rpc).not.toHaveBeenCalled();
});

it("returns FORBIDDEN when the location belongs to another account", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  rpc.mockResolvedValueOnce({
    data: { venue: { id: otherLocation } },
    error: null,
  });

  const result = await updateSchedule(location, week, { type: "publish" });

  expect(result).toEqual({
    error: {
      code: "FORBIDDEN",
      message: "You do not have access to this schedule.",
    },
  });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("schedule_load", {
    p_location: location,
    p_week: null,
  });
});

it("returns UNAUTHORIZED when loadScheduleReport has no verified user", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });

  const result = await loadScheduleReport(location, "2026-03-01");

  expect(result).toEqual({
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  });
  expect(rpc).not.toHaveBeenCalled();
});

it("scopes schedule_command to the verified location and never trusts body user ids", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  rpc
    .mockResolvedValueOnce({
      data: { venue: { id: location } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: {
        plan: "starter", status: "active", features: PLANS.starter.features,
        limits: JSON.parse(JSON.stringify(PLANS.starter.limits)), trial_ends_at: null, grace: false,
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { notified: 2 },
      error: null,
    });

  const result = await updateSchedule(location, week, { type: "publish" });

  expect(result).toEqual({ data: { notified: 2 } });
  expect(rpc).toHaveBeenNthCalledWith(3, "schedule_command", {
    p_action: "publish",
    p_location: location,
    p_week: week,
    p_payload: {},
  });
});
