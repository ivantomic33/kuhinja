import { z } from "https://esm.sh/zod@3.25.76";
import { createBillingAdmin } from "../_shared/billing-lock.ts";
import { planForPrice } from "../_shared/billing-prices.ts";
import { readPaidAccess, verifyPaddleSignature, type PaddleSubscription } from "../_shared/paddle.ts";

const readEnv = (key: string) => Deno.env.get(key);
const eventSchema = z.object({
  event_id: z.string().regex(/^evt_[a-z\d]{26}$/),
  event_type: z.string(),
  occurred_at: z.string().datetime({ offset: true }),
  data: z.unknown(),
});
const subscriptionSchema = z.object({
  id: z.string().regex(/^sub_[a-z\d]{26}$/),
  transaction_id: z.string().regex(/^txn_[a-z\d]{26}$/).nullish(),
  customer_id: z.string().regex(/^ctm_[a-z\d]{26}$/),
  status: z.enum(["active", "trialing", "past_due", "paused", "canceled"]),
  items: z.array(z.object({
    price: z.object({ id: z.string() }),
    trial_dates: z.object({ ends_at: z.string() }).nullish(),
  })),
  current_billing_period: z.object({ starts_at: z.string(), ends_at: z.string() }).nullable(),
  scheduled_change: z.object({ action: z.string(), effective_at: z.string() }).nullable(),
  custom_data: z.record(z.unknown()).nullable(),
});

let liveIps: { expires: number; addresses: Set<string> } | undefined;

async function fromPaddleIngress(request: Request) {
  const token = readEnv("PADDLE_INGRESS_TOKEN");
  if (!token || request.headers.get("X-TreuPlate-Ingress-Token") !== token) return false;
  const ip = request.headers.get("X-TreuPlate-Source-IP");
  if (!ip) return false;

  if (!liveIps || liveIps.expires <= Date.now()) {
    const response = await fetch("https://api.paddle.com/ips", { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error("paddle_ips_unavailable");
    const payload = z.object({ data: z.object({
      ipv4_cidrs: z.array(z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}\/32$/)).nonempty(),
    }) }).parse(await response.json());
    liveIps = {
      expires: Date.now() + 5 * 60_000,
      addresses: new Set(payload.data.ipv4_cidrs.map((cidr) => cidr.slice(0, -3))),
    };
  }
  return liveIps.addresses.has(ip);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const environment = readEnv("PADDLE_ENVIRONMENT");
  const secret = readEnv("PADDLE_WEBHOOK_SECRET");
  const accessSecret = readEnv("PADDLE_ACCESS_SECRET");
  const url = readEnv("SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !accessSecret || !url || !serviceRole ||
      (environment !== "sandbox" && environment !== "live")) {
    return new Response(null, { status: 503 });
  }

  const signature = request.headers.get("Paddle-Signature");
  if (!signature) return new Response(null, { status: 400 });
  try {
    if (environment === "live" && !(await fromPaddleIngress(request))) {
      return new Response(null, { status: 403 });
    }
    const raw = await request.text();
    if (!(await verifyPaddleSignature(raw, signature, secret))) return new Response(null, { status: 401 });
    const event = eventSchema.safeParse(JSON.parse(raw));
    if (!event.success) return new Response(null, { status: 400 });
    if (!event.data.event_type.startsWith("subscription.")) return new Response("ok");

    const checked = subscriptionSchema.safeParse(event.data.data);
    if (!checked.success) return new Response(null, { status: 400 });
    const subscription = checked.data;
    const item = subscription.items.length === 1 ? subscription.items[0] : undefined;
    const priceId = item?.price.id;
    const plan = priceId && planForPrice(readEnv, priceId);
    const candidate = await readPaidAccess(accessSecret, subscription.id,
      subscription.custom_data?.treuplate_paid_access);
    // Keep a higher paid-access holdover while the catalog price is lower
    // (e.g. Advanced/Pro residual access during a scheduled downgrade).
    const rank = { starter: 1, pro: 2, advanced: 3 } as const;
    const access = plan && candidate &&
        (rank[candidate.plan] ?? 0) > (rank[plan] ?? 0)
      ? candidate
      : null;

    const { data, error } = await createBillingAdmin(url, serviceRole).rpc("apply_paddle_subscription", {
      p_event_id: event.data.event_id,
      p_occurred_at: event.data.occurred_at,
      p_transaction_id: event.data.event_type === "subscription.created" ? subscription.transaction_id ?? null : null,
      p_subscription: {
        paddle_customer_id: subscription.customer_id,
        paddle_subscription_id: subscription.id,
        paddle_price_id: priceId ?? null,
        plan_key: plan || "free",
        status: subscription.status satisfies PaddleSubscription["status"],
        current_period_start: subscription.current_billing_period?.starts_at ?? null,
        current_period_end: subscription.current_billing_period?.ends_at ?? item?.trial_dates?.ends_at ?? null,
        trial_end: item?.trial_dates?.ends_at ?? null,
        cancel_at_period_end: subscription.scheduled_change?.action === "cancel",
        paid_access_plan: access?.plan ?? null,
        paid_access_until: access?.until ?? null,
      },
    });
    if (error) throw new Error(error.code);
    if (data === "awaiting_checkout") return new Response(null, { status: 503 });
    return new Response("ok");
  } catch (error) {
    console.error("Paddle webhook failed", error instanceof Error ? error.message : "unknown");
    return new Response(null, { status: 500 });
  }
});
