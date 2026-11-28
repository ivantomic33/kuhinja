import "server-only";
import type { z } from "zod";
import { checkoutIntent } from "@/lib/billing/checkout-intent";
import { getEntitlement } from "@/lib/billing/entitlements";
import { BillingConflict, paddleClient, withPlanMutation } from "@/lib/billing/paddle-server";
import { trialPriceIdFor, priceIdFor } from "@/lib/billing/plans";
import { hasRequiredConsents } from "@/lib/legal/consent";
import type { ActionUserContext } from "@/lib/server/action";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesPaddleInterval, matchingTrialPrice, type PaddlePrice, type PaddleTransaction } from "@/supabase/functions/_shared/paddle";
import { cancelPendingTransaction, customerSubscriptions, pendingSignupTransactions } from "@/supabase/functions/_shared/paddle-checkout";
import { paddleSdk } from "./sdk";

type PaddleCustomer = { id: string; status: string; custom_data: ({ supabase_user_id?: string } & Record<string, unknown>) | null };
type CheckoutResult = { transactionId: string } | { status: number; error: string };

export async function createCheckoutTransaction(
  auth: ActionUserContext,
  { plan_key: plan, interval }: z.infer<typeof checkoutIntent>,
): Promise<CheckoutResult> {
  const { user, supabase } = auth;
  if (!user.email || !user.email_confirmed_at) return { status: 401, error: "UNAUTHORIZED" };
  const email = user.email;
  try {
    if (user.app_metadata?.provider === "google" && !(await hasRequiredConsents(supabase, user.id))) {
      return { status: 403, error: "CONSENT_REQUIRED" };
    }
    return await withPlanMutation(user.id, async (): Promise<CheckoutResult> => {
      if ((await getEntitlement(supabase, user.id)).isPremium) {
        return { status: 409, error: "EXISTING_SUBSCRIPTION" };
      }

      const admin = createAdminClient();
      const profile = await admin.from("profiles").select("paddle_customer_id, full_name").eq("id", user.id).single();
      if (profile.error || !profile.data) return { status: 503, error: "PROFILE_UNAVAILABLE" };
      const api = paddleClient();
      let customerId = profile.data.paddle_customer_id;
      if (!customerId) {
        let customer: PaddleCustomer | undefined;
        for await (const match of api.list<PaddleCustomer>(`/customers?email=${encodeURIComponent(email)}`)) {
          if (match.status !== "active") continue;
          if (customer) return { status: 409, error: "CUSTOMER_CONFLICT" };
          const formerUser = match.custom_data?.supabase_user_id;
          if (formerUser === user.id) {
            customer = match;
            continue;
          }
          if (!formerUser) return { status: 409, error: "CUSTOMER_CONFLICT" };
          const released = await admin.from("paddle_released_customers").select("customer_id")
            .eq("customer_id", match.id).eq("former_user_id", formerUser).maybeSingle();
          if (released.error) return { status: 503, error: "PROFILE_UNAVAILABLE" };
          if (!released.data) return { status: 409, error: "CUSTOMER_CONFLICT" };
          customer = await api.patch<PaddleCustomer>(`/customers/${match.id}`, {
            custom_data: { ...match.custom_data, supabase_user_id: user.id },
          });
        }
        customer ??= await api.post<PaddleCustomer>("/customers", {
          email,
          ...(profile.data.full_name && { name: profile.data.full_name }),
          custom_data: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        const saved = await admin.from("profiles").update({ paddle_customer_id: customerId })
          .eq("id", user.id).select("id").single();
        if (saved.error || !saved.data) return { status: 503, error: "CUSTOMER_SAVE_FAILED" };
      }

      let returning = false;
      for await (const subscription of customerSubscriptions(api, customerId)) {
        returning = true;
        if (subscription.status !== "canceled") return { status: 409, error: "EXISTING_SUBSCRIPTION" };
      }

      const regularId = priceIdFor(plan, interval);
      if (!regularId) return { status: 503, error: "PRICE_UNAVAILABLE" };
      const regular = await api.get<PaddlePrice>(`/prices/${regularId}`);
      if (!matchesPaddleInterval(regular, interval) || regular.trial_period) {
        return { status: 503, error: "PRICE_UNAVAILABLE" };
      }

      let priceId = regularId;
      const trialId = !returning && trialPriceIdFor(plan, interval);
      if (trialId) {
        const trial = await api.get<PaddlePrice>(`/prices/${trialId}`);
        if (matchesPaddleInterval(trial, interval) && matchingTrialPrice(trial, regular)) priceId = trialId;
      }

      let reusable: PaddleTransaction | undefined;
      for await (const transaction of pendingSignupTransactions(api, customerId)) {
        if (transaction.status === "paid") return { status: 409, error: "CHECKOUT_PROCESSING" };
        if (!reusable && transaction.items.length === 1 && transaction.items[0].price.id === priceId) {
          reusable = transaction;
        } else {
          await cancelPendingTransaction(api, transaction);
        }
      }

      const transactionId = reusable?.id ?? (await paddleSdk().transactions.create({
        items: [{ priceId, quantity: 1 }],
        customerId,
        collectionMode: "automatic",
        customData: { treuplate_checkout: true, user_id: user.id },
      })).id;
      if (!/^txn_[a-z\d]{26}$/.test(transactionId)) return { status: 503, error: "CHECKOUT_UNAVAILABLE" };

      const authorization = await admin.from("paddle_checkout_authorizations").upsert({
        transaction_id: transactionId, user_id: user.id, customer_id: customerId, price_id: priceId,
      }, { onConflict: "transaction_id", ignoreDuplicates: true });
      if (authorization.error) return { status: 503, error: "CHECKOUT_UNAVAILABLE" };
      return { transactionId };
    });
  } catch (error) {
    if (error instanceof BillingConflict) return { status: 409, error: "BILLING_BUSY" };
    console.error("Paddle checkout failed");
    return { status: 502, error: "CHECKOUT_FAILED" };
  }
}
