import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://esm.sh/zod@3.25.76";
import { BillingBusyError, createBillingAdmin, withBillingLock } from "../_shared/billing-lock.ts";
import { configuredPrice, paidPlans, planForPrice } from "../_shared/billing-prices.ts";
import { matchesPaddleInterval, matchingTrialPrice, paddleApi, type PaddlePrice, type PaddleTransaction } from "../_shared/paddle.ts";
import { cancelPendingTransaction, customerSubscriptions, pendingSignupTransactions } from "../_shared/paddle-checkout.ts";

const readEnv = (key: string) => Deno.env.get(key);
const input = z.object({
  plan_key: z.enum(paidPlans).default("pro"),
  interval: z.enum(["month", "year", "monthly", "yearly"]).default("monthly"),
}).strict();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: object) {
  return Response.json(body, { status, headers: cors });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type PaddleCustomer = { id: string; status: string; custom_data: ({ supabase_user_id?: string } & Record<string, unknown>) | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const url = readEnv("SUPABASE_URL");
  const anonKey = readEnv("SUPABASE_ANON_KEY");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const site = readEnv("SITE_URL");
  if (!url || !anonKey || !serviceRole || !site) return json(503, { error: "BILLING_UNAVAILABLE" });

  try {
    const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return json(401, { error: "UNAUTHORIZED" });
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user?.email || !user.email_confirmed_at) return json(401, { error: "UNAUTHORIZED" });

    const raw = await req.text();
    const parsed = input.safeParse(raw ? parseJson(raw) : {});
    if (!parsed.success) return json(400, { error: "VALIDATION_ERROR" });
    const { plan_key: plan } = parsed.data;
    const interval = parsed.data.interval === "year" || parsed.data.interval === "yearly" ? "yearly" : "monthly";
    const admin = createBillingAdmin(url, serviceRole);

    return await withBillingLock(admin, `customer:${user.id}`, async () => {
      const { data: profile, error: profileError } = await admin.from("profiles")
        .select("paddle_customer_id, full_name").eq("id", user.id).single();
      if (profileError || !profile) return json(503, { error: "PROFILE_UNAVAILABLE" });
      const api = paddleApi(readEnv);
      let customerId = profile.paddle_customer_id as string | null;
      if (!customerId) {
        // Reuse a customer created by a previous attempt before the local save succeeded.
        let customer: PaddleCustomer | undefined;
        for await (const match of api.list<PaddleCustomer>(`/customers?email=${encodeURIComponent(user.email!)}`)) {
          if (match.status !== "active") continue;
          if (customer) return json(409, { error: "CUSTOMER_CONFLICT" });
          const formerUser = match.custom_data?.supabase_user_id;
          if (formerUser !== user.id) {
            if (!formerUser) return json(409, { error: "CUSTOMER_CONFLICT" });
            const released = await admin.from("paddle_released_customers").select("customer_id")
              .eq("customer_id", match.id).eq("former_user_id", formerUser).maybeSingle();
            if (released.error) return json(503, { error: "PROFILE_UNAVAILABLE" });
            if (!released.data) return json(409, { error: "CUSTOMER_CONFLICT" });
            customer = await api.patch<PaddleCustomer>(`/customers/${match.id}`, {
              custom_data: { ...match.custom_data, supabase_user_id: user.id },
            });
          } else {
            customer = match;
          }
        }
        customer ??= await api.post<PaddleCustomer>("/customers", {
          email: user.email,
          ...(profile.full_name && { name: profile.full_name }),
          custom_data: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        const { data: saved, error: saveError } = await admin.from("profiles")
          .update({ paddle_customer_id: customerId }).eq("id", user.id).select("id").single();
        if (saveError || !saved) return json(503, { error: "CUSTOMER_SAVE_FAILED" });
      }

      let returning = false;
      for await (const subscription of customerSubscriptions(api, customerId)) {
        returning = true;
        if (subscription.status !== "canceled") return json(409, { error: "EXISTING_SUBSCRIPTION" });
      }

      // Catalog price is always required. A dedicated 14-day trial price is optional and
      // only used for first-time customers when it is configured and valid in Paddle.
      const regularId = configuredPrice(readEnv, plan, interval);
      if (!regularId || planForPrice(readEnv, regularId) !== plan) {
        return json(503, { error: "PRICE_UNAVAILABLE" });
      }
      const regular = await api.get<PaddlePrice>(`/prices/${regularId}`);
      if (!matchesPaddleInterval(regular, interval) || regular.trial_period) {
        return json(503, { error: "PRICE_UNAVAILABLE" });
      }

      let priceId = regularId;
      if (!returning) {
        const trialId = configuredPrice(readEnv, plan, interval, true);
        if (trialId && planForPrice(readEnv, trialId) === plan) {
          const trial = await api.get<PaddlePrice>(`/prices/${trialId}`);
          if (matchesPaddleInterval(trial, interval) && matchingTrialPrice(trial, regular)) {
            priceId = trialId;
          }
        }
      }

      let reusable: PaddleTransaction | undefined;
      for await (const transaction of pendingSignupTransactions(api, customerId)) {
        if (transaction.status === "paid") return json(409, { error: "CHECKOUT_PROCESSING" });
        if (!reusable && transaction.items.length === 1 &&
            transaction.items[0].price.id === priceId) {
          reusable = transaction;
        } else {
          await cancelPendingTransaction(api, transaction);
        }
      }
      const transaction = reusable ?? await api.post<PaddleTransaction>("/transactions", {
        items: [{ price_id: priceId, quantity: 1 }],
        customer_id: customerId,
        collection_mode: "automatic",
        custom_data: { treuplate_checkout: true },
      });
      if (!/^txn_[a-z\d]{26}$/.test(transaction.id)) {
        return json(503, { error: "CHECKOUT_UNAVAILABLE" });
      }

      // Overlay checkout only needs the transaction id. Build the app payment-link URL
      // from SITE_URL so a mismatched Paddle default payment link cannot block checkout.
      let siteOrigin: string;
      try {
        siteOrigin = new URL(site).origin;
      } catch {
        return json(503, { error: "BILLING_UNAVAILABLE" });
      }

      const authorized = await admin.from("paddle_checkout_authorizations").upsert({
        transaction_id: transaction.id, user_id: user.id, customer_id: customerId, price_id: priceId,
      }, { onConflict: "transaction_id", ignoreDuplicates: true });
      if (authorized.error) return json(503, { error: "CHECKOUT_UNAVAILABLE" });
      return json(200, { url: `${siteOrigin}/checkout?_ptxn=${transaction.id}` });
    });
  } catch (error) {
    if (error instanceof BillingBusyError) return json(409, { error: "BILLING_BUSY" });
    console.error("Paddle checkout failed", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "CHECKOUT_FAILED" });
  }
});
