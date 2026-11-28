import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const { authenticate, transact } = vi.hoisted(() => ({ authenticate: vi.fn(), transact: vi.fn() }));
vi.mock("@/lib/server/action", () => ({ requireActionUser: authenticate }));
vi.mock("@/lib/paddle/checkout", () => ({ createCheckoutTransaction: transact }));

const auth = { user: { id: "verified-user" }, supabase: {} };

function request(body: object) {
  return new Request("https://treuplate.example/api/billing/transaction", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}

beforeEach(() => vi.resetAllMocks());

it("responds with 401 without a verified session", async () => {
  authenticate.mockResolvedValue({ error: { code: "UNAUTHORIZED" } });
  expect((await POST(request({ priceTier: "monthly" }))).status).toBe(401);
  expect(transact).not.toHaveBeenCalled();
});

it("rejects a client-provided user ID and forwards only the verified identity", async () => {
  authenticate.mockResolvedValue(auth);
  expect((await POST(request({ priceTier: "monthly", user_id: "another-user" }))).status).toBe(400);
  expect(transact).not.toHaveBeenCalled();

  transact.mockResolvedValue({ transactionId: "txn_example" });
  expect(await (await POST(request({ priceTier: "monthly" }))).json()).toEqual({ transactionId: "txn_example" });
  expect(transact).toHaveBeenCalledExactlyOnceWith(auth, { interval: "monthly", plan_key: "pro" });
});

it("passes through a subscription conflict", async () => {
  authenticate.mockResolvedValue(auth);
  transact.mockResolvedValue({ status: 409, error: "EXISTING_SUBSCRIPTION" });
  expect((await POST(request({ priceTier: "yearly" }))).status).toBe(409);
});
