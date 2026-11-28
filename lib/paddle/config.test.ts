import { expect, it } from "vitest";
import { getPaddleConfig } from "./config";

const env = {
  PADDLE_API_KEY: "fixture",
  PADDLE_WEBHOOK_SECRET: "fixture",
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_fixture",
  NEXT_PUBLIC_PADDLE_ENVIRONMENT: "sandbox",
  NEXT_PUBLIC_PADDLE_PRICE_MONTHLY: "pri_" + "m".repeat(26),
  NEXT_PUBLIC_PADDLE_PRICE_YEARLY: "pri_" + "y".repeat(26),
};

it("requires the complete configuration and reports field names without values", () => {
  expect(getPaddleConfig(env)).toMatchObject({ NEXT_PUBLIC_PADDLE_ENVIRONMENT: "sandbox" });
  expect(() => getPaddleConfig({ ...env, PADDLE_WEBHOOK_SECRET: undefined })).toThrow("PADDLE_WEBHOOK_SECRET");
  expect(() => getPaddleConfig({ ...env, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_confidential" }))
    .toThrow("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  expect(() => getPaddleConfig({ ...env, NEXT_PUBLIC_PADDLE_ENVIRONMENT: "live" }))
    .toThrow("NEXT_PUBLIC_PADDLE_ENVIRONMENT");
});
