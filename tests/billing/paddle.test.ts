import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { matchingTrialPrice, paddleApiBase, verifyPaddleSignature, type PaddlePrice } from "@/supabase/functions/_shared/paddle";
import { configuredPrice, planForPrice } from "@/supabase/functions/_shared/billing-prices";

const priceId = `pri_${"a".repeat(26)}`;

describe("Paddle billing configuration", () => {
  it("requires an explicit environment and selects the correct API", () => {
    expect(paddleApiBase("sandbox")).toBe("https://sandbox-api.paddle.com");
    expect(paddleApiBase("live")).toBe("https://api.paddle.com");
    expect(() => paddleApiBase(undefined)).toThrow();
  });

  it("maps regular and first-time trial prices and rejects ambiguous configuration", () => {
    const config: Record<string, string> = { PADDLE_PRICE_STARTER_MONTHLY_TRIAL_ID: priceId };
    const env = (key: string) => config[key];
    expect(configuredPrice(env, "starter", "monthly", true)).toBe(priceId);
    expect(configuredPrice(env, "starter", "monthly")).toBeUndefined();
    expect(planForPrice(env, priceId)).toBe("starter");
    config.PADDLE_PRICE_PRO_MONTHLY_ID = priceId;
    expect(planForPrice(env, priceId)).toBeNull();
  });
});

it("requires the first-time trial and advertised price to use the same product, terms and amount", () => {
  const regular: PaddlePrice = {
    id: priceId, product_id: "pro_example", status: "active", tax_mode: "account_setting",
    unit_price: { amount: "1900", currency_code: "EUR" },
    billing_cycle: { interval: "month", frequency: 1 }, trial_period: null,
  };
  const trial = { ...regular, trial_period: {
    interval: "day", frequency: 14, requires_payment_method: true, unit_price: null,
  } };
  expect(matchingTrialPrice(trial, regular)).toBe(true);
  expect(matchingTrialPrice({ ...trial, unit_price: { amount: "2900", currency_code: "EUR" } }, regular)).toBe(false);
  expect(matchingTrialPrice({ ...trial, trial_period: { ...trial.trial_period, frequency: 7 } }, regular)).toBe(false);
});

describe("Paddle webhook signatures", () => {
  it("authenticates the raw body and rejects modifications and expired timestamps", async () => {
    const now = 1_800_000_000;
    const body = '{"event_id":"evt_example"}';
    const secret = "test-secret";
    const digest = createHmac("sha256", secret).update(`${now}:${body}`).digest("hex");
    const header = `ts=${now};h1=${"0".repeat(64)};h1=${digest}`;
    expect(await verifyPaddleSignature(body, header, secret, now)).toBe(true);
    expect(await verifyPaddleSignature(`${body} `, header, secret, now)).toBe(false);
    expect(await verifyPaddleSignature(body, header, secret, now + 301)).toBe(false);
  });
});
