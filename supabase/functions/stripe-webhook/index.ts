// Supabase Edge Function: stripe-webhook
// Verifies Stripe signature. Updates profiles.plan / plan_expires_at via
// service role only. Idempotent on event id.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AdminClient = ReturnType<typeof createClient>;

/** Active-like statuses keep Premium. Never trust client plan values. */
function planFromSubscriptionStatus(
  status: Stripe.Subscription.Status
): "premium" | "free" {
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due"
  ) {
    return "premium";
  }
  return "free";
}

function expiresAtFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  if (typeof subscription.current_period_end === "number") {
    return new Date(subscription.current_period_end * 1000).toISOString();
  }
  return null;
}

async function findUserId(
  admin: AdminClient,
  opts: {
    customerId?: string | null;
    clientReferenceId?: string | null;
    metadataUserId?: string | null;
  }
): Promise<string | null> {
  const meta = opts.metadataUserId || opts.clientReferenceId;
  if (meta && typeof meta === "string") {
    return meta;
  }

  if (opts.customerId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", opts.customerId)
      .maybeSingle();
    return data?.id ?? null;
  }

  return null;
}

async function applyPlanUpdate(
  admin: AdminClient,
  userId: string,
  plan: "premium" | "free",
  planExpiresAt: string | null,
  stripeCustomerId?: string | null
) {
  const patch: Record<string, unknown> = {
    plan,
    plan_expires_at: planExpiresAt,
  };
  if (stripeCustomerId) {
    patch.stripe_customer_id = stripeCustomerId;
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) {
    throw new Error("Failed to update profile plan");
  }
}

async function syncSubscription(
  admin: AdminClient,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const userId = await findUserId(admin, {
    customerId,
    metadataUserId: subscription.metadata?.supabase_user_id ?? null,
  });

  if (!userId) {
    console.error("stripe-webhook: no user for subscription", subscription.id);
    return;
  }

  const plan = planFromSubscriptionStatus(subscription.status);
  const expiresAt =
    plan === "free" ? null : expiresAtFromSubscription(subscription);

  await applyPlanUpdate(admin, userId, plan, expiresAt, customerId);
}

async function handleCheckoutCompleted(
  admin: AdminClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const userId = await findUserId(admin, {
    customerId,
    clientReferenceId: session.client_reference_id,
    metadataUserId: session.metadata?.supabase_user_id ?? null,
  });

  if (!userId) {
    console.error("stripe-webhook: no user for checkout", session.id);
    return;
  }

  if (customerId) {
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!subscriptionId) {
    // Checkout done but subscription missing — mark premium with null expiry;
    // subscription.* events will refine.
    await applyPlanUpdate(admin, userId, "premium", null, customerId);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(admin, subscription);
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !stripeSecretKey ||
      !webhookSecret
    ) {
      return json(500, { error: "Missing server configuration" });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return json(400, { error: "Missing stripe-signature" });
    }

    const body = await req.text();

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return json(400, { error: "Invalid signature" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Idempotency: skip if this event id was already processed
    const { data: existing } = await admin
      .from("stripe_webhook_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (existing) {
      return json(200, { received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(admin, stripe, session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null;

        const userId = await findUserId(admin, {
          customerId,
          metadataUserId: subscription.metadata?.supabase_user_id ?? null,
        });

        if (userId) {
          await applyPlanUpdate(admin, userId, "free", null, customerId);
        }
        break;
      }
      default:
        // Ignore other event types
        break;
    }

    // Record after successful handling so retries re-run on failure
    const { error: insertError } = await admin
      .from("stripe_webhook_events")
      .insert({ id: event.id, type: event.type });

    // Unique violation → another worker finished first (still OK)
    if (insertError && insertError.code !== "23505") {
      console.error("stripe-webhook: failed to record event", insertError);
    }

    return json(200, { received: true });
  } catch (err) {
    console.error("stripe-webhook error", err);
    return json(500, { error: "Webhook handler failed" });
  }
});
