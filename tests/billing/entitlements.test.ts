import { afterEach, describe, expect, it, vi } from "vitest";
import { planFromPriceId, priceIdFor } from "@/lib/billing/plans";
import { effectivePlan } from "@/supabase/functions/_shared/entitlements";

const now = Date.parse("2026-11-24T12:00:00Z");
const day = 86_400_000;

describe("subscription entitlement", () => {
  it.each([
    ["active", "pro"], ["trialing", "pro"], ["past_due", "pro"],
    ["canceled", "free"], ["unpaid", "free"], ["incomplete", "free"],
    ["incomplete_expired", "free"], ["paused", "free"], [null, "free"],
  ] as const)("maps %s to %s", (status, plan) => {
    expect(effectivePlan("pro", status, now - day, now).plan).toBe(plan);
  });

  it("expires grace exactly seven days after the period ends", () => {
    expect(effectivePlan("starter", "past_due", now - 7 * day + 1, now))
      .toEqual({ plan: "starter", grace: true });
    expect(effectivePlan("starter", "past_due", now - 7 * day, now))
      .toEqual({ plan: "free", grace: false });
    expect(effectivePlan("starter", "past_due", null, now).plan).toBe("free");
    expect(effectivePlan("starter", "past_due", now + 1, now).plan).toBe("free");
  });

  it("requires a known paid plan even with active status", () => {
    expect(effectivePlan(null, "active", now, now).plan).toBe("free");
  });
});

describe("Paddle price allowlist", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("maps regular and trial prices and rejects unknown prices", () => {
    vi.stubEnv("PADDLE_PRICE_STARTER_MONTHLY_ID", "pri_ssssssssssssssssssssssssss");
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_ID", "pri_pppppppppppppppppppppppppp");
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_TRIAL_ID", "pri_tttttttttttttttttttttttttt");
    expect(priceIdFor("starter", "monthly")).toBe("pri_ssssssssssssssssssssssssss");
    expect(planFromPriceId("pri_ssssssssssssssssssssssssss")).toBe("starter");
    expect(planFromPriceId("pri_pppppppppppppppppppppppppp")).toBe("pro");
    expect(planFromPriceId("pri_tttttttttttttttttttttttttt")).toBe("pro");
    expect(planFromPriceId("price_unknown")).toBeNull();
  });
});
