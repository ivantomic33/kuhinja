import { createHmac } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST } from "./route";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/paddle/config", () => ({
  getPaddleConfig: () => ({ PADDLE_WEBHOOK_SECRET: "verification-test-fixture", PADDLE_API_KEY: "unit_test", NEXT_PUBLIC_PADDLE_ENVIRONMENT: "sandbox" }),
  paddleId: (prefix: string) => z.string().startsWith(prefix + "_"),
}));

const secret = "verification-test-fixture";
const data = {
  id: "sub_" + "s".repeat(26),
  customer_id: "ctm_" + "c".repeat(26),
  transaction_id: "txn_" + "t".repeat(26),
  status: "active",
  items: [{ price: { id: "pri_" + "p".repeat(26) } }],
  custom_data: { user_id: "11111111-1111-4111-8111-111111111111" },
  billing_cycle: { interval: "month", frequency: 1 },
  current_billing_period: null,
  scheduled_change: null,
};
function request({
  tampered = false, age = 0, fakeSignature = false,
  eventType = "subscription.created", status = data.status,
}: { tampered?: boolean; age?: number; fakeSignature?: boolean; eventType?: string; status?: string } = {}) {
  const body = JSON.stringify({
    event_id: "evt_" + "e".repeat(26),
    event_type: eventType,
    occurred_at: "2026-11-27T12:00:00Z",
    data: { ...data, status },
  });
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const digest = fakeSignature
    ? "0".repeat(64)
    : createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
  return new Request("http://localhost/api/webhooks/paddle", {
    method: "POST", headers: { "paddle-signature": `ts=${timestamp};h1=${digest}` },
    body: tampered ? body + " " : body,
  });
}

beforeEach(() => rpc.mockReset());

it("rejects altered or expired signatures before calling the database", async () => {
  expect((await POST(request({ fakeSignature: true }))).status).toBe(400);
  expect((await POST(request({ tampered: true }))).status).toBe(400);
  expect((await POST(request({ age: 30 }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

it.each([
  ["subscription.updated", "active"],
  ["subscription.canceled", "canceled"],
  ["subscription.past_due", "past_due"],
])("synchronizes %s with status %s", async (eventType, status) => {
  rpc.mockResolvedValue({ data: "applied", error: null });
  expect((await POST(request({ eventType, status }))).status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("apply_paddle_subscription", expect.objectContaining({
    p_event_type: eventType, p_transaction_id: null,
    p_subscription: expect.objectContaining({ status }),
  }));
});

it.each(["transaction.completed", "transaction.payment_failed"])(
  "acknowledges %s without overriding canonical subscription state", async (eventType) => {
    expect((await POST(request({ eventType }))).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  },
);

it("acknowledges duplicate events through the atomic event RPC", async () => {
  rpc.mockResolvedValue({ data: "duplicate", error: null });
  expect((await POST(request())).status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("apply_paddle_subscription", expect.objectContaining({
    p_event_type: "subscription.created", p_transaction_id: data.transaction_id,
    p_subscription: expect.objectContaining({ user_id: data.custom_data.user_id, paddle_customer_id: data.customer_id }),
  }));
});

it("returns a retryable error when the atomic event write fails", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
  expect((await POST(request())).status).toBe(500);
  expect(rpc).toHaveBeenCalledTimes(1);
});
