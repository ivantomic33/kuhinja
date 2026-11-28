import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaddleConfig, paddleId } from "@/lib/paddle/config";
import { paddleSdk } from "@/lib/paddle/sdk";
import { planFromPriceId } from "@/lib/billing/plans";
import { readPaidAccess } from "@/supabase/functions/_shared/paddle";

export const runtime = "nodejs";

const lifecycleEvents = new Set([
  "subscription.created", "subscription.updated", "subscription.activated",
  "subscription.trialing", "subscription.canceled", "subscription.past_due",
  "subscription.paused", "subscription.resumed",
]);
const timestamp = z.string().datetime({ offset: true });
const envelope = z.object({
  event_id: paddleId("evt"),
  event_type: z.string(),
  occurred_at: timestamp,
  data: z.unknown(),
});
const subscriptionSchema = z.object({
  id: paddleId("sub"),
  customer_id: paddleId("ctm"),
  transaction_id: paddleId("txn").nullish(),
  status: z.enum(["trialing", "active", "past_due", "paused", "canceled"]),
  canceled_at: timestamp.nullish(),
  items: z.array(z.object({
    price: z.object({ id: paddleId("pri") }).nullish(),
    trial_dates: z.object({ ends_at: timestamp }).nullish(),
  })),
  current_billing_period: z.object({ starts_at: timestamp, ends_at: timestamp }).nullish(),
  scheduled_change: z.object({ action: z.string(), effective_at: timestamp }).nullish(),
  custom_data: z.object({
    user_id: z.string().uuid().nullish(),
    treuplate_paid_access: z.unknown().optional(),
  }).nullish(),
});

export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature");
  if (!signature) return new Response(null, { status: 400 });

  let config: ReturnType<typeof getPaddleConfig>;
  try {
    config = getPaddleConfig();
  } catch {
    return new Response(null, { status: 503 });
  }

  let raw: string;
  try {
    raw = await request.text();
    await paddleSdk().webhooks.unmarshal(raw, config.PADDLE_WEBHOOK_SECRET, signature);
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = envelope.safeParse(JSON.parse(raw));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { event_id, event_type, occurred_at, data } = parsed.data;
  if (!lifecycleEvents.has(event_type)) return new Response("ok");

  const checked = subscriptionSchema.safeParse(data);
  if (!checked.success) return new Response(null, { status: 400 });
  const subscription = checked.data;

  try {
    const item = subscription.items.length === 1 ? subscription.items[0] : undefined;
    const priceId = item?.price?.id;
    const plan = priceId ? planFromPriceId(priceId) : null;
    const accessSecret = process.env.PADDLE_ACCESS_SECRET;
    const holdover = accessSecret
      ? await readPaidAccess(accessSecret, subscription.id, subscription.custom_data?.treuplate_paid_access)
      : null;
    const rank = { starter: 1, pro: 2, advanced: 3 };
    const access = plan && holdover && rank[holdover.plan] > rank[plan] ? holdover : null;

    // A signed webhook may carry metadata written by Paddle.js. The RPC validates
    // the customer mapping and the server's checkout authorization independently.
    const result = await createAdminClient().rpc("apply_paddle_subscription", {
      p_event_id: event_id,
      p_event_type: event_type,
      p_occurred_at: occurred_at,
      p_transaction_id: event_type === "subscription.created" ? subscription.transaction_id ?? null : null,
      p_subscription: {
        user_id: subscription.custom_data?.user_id ?? null,
        paddle_customer_id: subscription.customer_id,
        paddle_subscription_id: subscription.id,
        price_id: priceId ?? null,
        plan_key: plan ?? "free",
        status: subscription.status,
        current_period_start: subscription.current_billing_period?.starts_at ?? null,
        current_period_end: subscription.current_billing_period?.ends_at
          ?? (subscription.status === "trialing" ? item?.trial_dates?.ends_at ?? null : null),
        trial_end: item?.trial_dates?.ends_at ?? null,
        canceled_at: subscription.canceled_at ?? (subscription.status === "canceled" ? occurred_at : null),
        cancel_at_period_end: subscription.scheduled_change?.action === "cancel",
        paid_access_plan: access?.plan ?? null,
        paid_access_until: access?.until ?? null,
      },
    });
    if (result.error) throw new Error("Database write failed");
    if (result.data === "awaiting_checkout" || result.data === "unauthorized_checkout") {
      // Checkout may still be committing the server's transaction authorization.
      return new Response(null, { status: 503 });
    }
    return new Response("ok");
  } catch {
    console.error("Paddle webhook processing failed", { eventId: event_id, eventType: event_type });
    return new Response(null, { status: 500 });
  }
}
