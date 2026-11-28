import { z } from "zod";
import { checkoutIntent } from "@/lib/billing/checkout-intent";
import { createCheckoutTransaction } from "@/lib/paddle/checkout";
import { requireActionUser } from "@/lib/server/action";

export const runtime = "nodejs";

const inputSchema = z.union([
  checkoutIntent.strict(),
  z.object({ priceTier: z.enum(["monthly", "yearly"]) }).strict()
    .transform(({ priceTier }) => ({ plan_key: "pro" as const, interval: priceTier })),
]);

export async function POST(request: Request) {
  const auth = await requireActionUser();
  if ("error" in auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const result = await createCheckoutTransaction(auth, input.data);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
