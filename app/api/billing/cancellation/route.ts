import { z } from "zod";
import { requireManageableSubscription } from "@/lib/billing/guard";
import { retrieveManageablePaddleSubscription, setPaddleCancellation, paddleClient, withPlanMutation, BillingConflict } from "@/lib/billing/paddle-server";

const cancellationSchema = z.object({ cancelAtPeriodEnd: z.boolean() }).strict();

export async function POST(request: Request) {
  const parsed = cancellationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_ERROR" } }, { status: 400 });

  const access = await requireManageableSubscription();
  if ("error" in access) return Response.json({ error: access.error }, { status: access.error.status });

  try {
    return await withPlanMutation(access.userId, async () => {
      const paddle = paddleClient();
      const subscription = await retrieveManageablePaddleSubscription(paddle,
        access.subscription.paddle_subscription_id, access.subscription.paddle_customer_id);
      const outcome = subscription && await setPaddleCancellation(paddle, subscription, parsed.data.cancelAtPeriodEnd);
      if (!outcome) return Response.json({ error: { code: "SUBSCRIPTION_CONFLICT" } }, { status: 409 });
      return Response.json(outcome);
    });
  } catch (error) {
    if (error instanceof BillingConflict) return Response.json({ error: { code: "BILLING_BUSY" } }, { status: 409 });
    console.error("Paddle cancellation failed");
    return Response.json({ error: { code: "BILLING_FAILED" } }, { status: 502 });
  }
}
