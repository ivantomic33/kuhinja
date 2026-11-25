import { z } from "zod";
import { requireManageableSubscription } from "@/lib/billing/guard";
import { priceIdFor } from "@/lib/billing/plans";
import { changePaddlePlan, retrieveManageablePaddleSubscription, paddleClient, withPlanMutation, BillingConflict } from "@/lib/billing/paddle-server";
import { paidPlans } from "@/supabase/functions/_shared/billing-prices";

const changePlanSchema = z.object({
  planKey: z.enum(paidPlans),
  interval: z.enum(["monthly", "yearly"]),
}).strict();

export async function POST(request: Request) {
  const parsed = changePlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });

  const access = await requireManageableSubscription();
  if ("error" in access) return Response.json({ error: access.error }, { status: access.error.status });

  const priceId = priceIdFor(parsed.data.planKey, parsed.data.interval);
  if (!priceId) return Response.json({ error: { code: "PRICE_UNAVAILABLE" } }, { status: 503 });
  try {
    return await withPlanMutation(access.userId, async () => {
      const paddle = paddleClient();
      const subscription = await retrieveManageablePaddleSubscription(paddle,
        access.subscription.paddle_subscription_id, access.subscription.paddle_customer_id);
      const outcome = subscription && await changePaddlePlan(paddle, subscription,
        parsed.data.planKey, parsed.data.interval, priceId);
      if (!outcome) return Response.json({ error: { code: "SUBSCRIPTION_CONFLICT" } }, { status: 409 });
      return Response.json(outcome);
    });
  } catch (error) {
    if (error instanceof BillingConflict) return Response.json({ error: { code: "BILLING_BUSY" } }, { status: 409 });
    console.error("Paddle change-plan failed");
    return Response.json({ error: { code: "BILLING_FAILED" } }, { status: 502 });
  }
}
