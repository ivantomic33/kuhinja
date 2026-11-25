import { actionError, requireActionUser, type ActionError, type ActionUserContext } from "@/lib/server/action";
import { entitlementSchema, type Entitlements } from "./entitlements";
import type { BillingSubscription } from "@/lib/supabase/database.types";
import type { BillingFeature } from "./plans";

export async function requireFeature(
  feature: BillingFeature, context?: ActionUserContext,
): Promise<(ActionUserContext & { entitlements: Entitlements }) | ActionError> {
  const auth = context ?? await requireActionUser();
  if ("error" in auth) return { error: { ...auth.error, status: 401 } } satisfies ActionError;

  const { data, error } = await auth.supabase.rpc("get_entitlements", { p_user_id: auth.user.id });
  const entitlements = entitlementSchema.safeParse(data);
  if (error || !entitlements.success) {
    return { error: { ...actionError("INTERNAL_ERROR", "Prava pristupa nisu dostupna.").error, status: 500 } } satisfies ActionError;
  }

  if (!entitlements.data.features[feature]) {
    return {
      error: {
        code: "UPGRADE_REQUIRED",
        message: "Za ovu funkciju potrebna je odgovarajuća pretplata.",
        status: 403,
      },
    } satisfies ActionError;
  }

  return { ...auth, entitlements: entitlements.data };
}

type ManageableSubscription = Pick<BillingSubscription,
  "paddle_subscription_id" | "paddle_customer_id" | "plan_key" | "status" |
  "current_period_end" | "cancel_at_period_end"
> & { plan_key: "starter" | "pro"; paddle_subscription_id: string; paddle_customer_id: string };

export async function requireManageableSubscription(): Promise<{ subscription: ManageableSubscription; userId: string } | ActionError> {
  const access = await requireFeature("manageSubscription");
  if ("error" in access) return access;

  const { data, error } = await access.supabase.from("subscriptions")
    .select("paddle_subscription_id, paddle_customer_id, plan_key, status, current_period_end, cancel_at_period_end")
    .eq("user_id", access.user.id)
    .not("paddle_subscription_id", "is", null)
    .in("status", ["active", "trialing"])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return {
    error: { ...actionError("INTERNAL_ERROR", "Pretplata nije dostupna.").error, status: 500 },
  } satisfies ActionError;
  if (!data?.paddle_customer_id || !data.paddle_subscription_id || (data.plan_key !== "starter" && data.plan_key !== "pro")) return {
    error: { ...actionError("UPGRADE_REQUIRED", "Potrebna je aktivna ili probna pretplata.").error, status: 403 },
  } satisfies ActionError;

  return { subscription: data as ManageableSubscription, userId: access.user.id };
}
