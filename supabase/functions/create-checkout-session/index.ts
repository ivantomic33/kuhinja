// Supabase Edge Function: create-checkout-session
// Authenticated users only. Creates/reuses Stripe customer, starts Checkout
// with a 14-day trial. Plan is never taken from the client.
//
// Deploy: supabase functions deploy create-checkout-session
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY_ID, STRIPE_PRICE_YEARLY_ID,
//          SITE_URL (plus auto SUPABASE_URL / ANON / SERVICE_ROLE)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Interval = "month" | "year";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseInterval(value: unknown): Interval {
  if (value === "year" || value === "yearly") return "year";
  return "month";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceMonthly = Deno.env.get("STRIPE_PRICE_MONTHLY_ID");
    const priceYearly = Deno.env.get("STRIPE_PRICE_YEARLY_ID");
    const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !stripeSecretKey ||
      !priceMonthly ||
      !priceYearly ||
      !siteUrl
    ) {
      return json(500, { error: "Missing server configuration" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "Unauthorized" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    let interval: Interval = "month";
    try {
      const body = await req.json();
      interval = parseInterval(body?.interval);
    } catch {
      // empty body → monthly
    }

    // Price IDs come only from secrets — never from the client plan/price.
    const priceId = interval === "year" ? priceYearly : priceMonthly;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, stripe_customer_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return json(404, { error: "Profile not found" });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let customerId = profile.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      const { error: updateError } = await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateError) {
        return json(500, { error: "Failed to save customer" });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
      success_url: `${siteUrl}/settings/billing?checkout=success`,
      cancel_url: `${siteUrl}/premium?checkout=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return json(500, { error: "Checkout session missing URL" });
    }

    return json(200, { url: session.url });
  } catch {
    return json(500, { error: "Unexpected error" });
  }
});
