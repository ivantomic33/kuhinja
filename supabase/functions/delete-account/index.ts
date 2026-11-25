// Supabase Edge Function: delete-account
// Verifies the caller before invoking the service-role-only deletion transaction.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { paddleApi } from "../_shared/paddle.ts";
import { cancelPendingTransaction, customerSubscriptions, pendingSignupTransactions } from "../_shared/paddle-checkout.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import {
  BillingBusyError,
  createBillingAdmin,
  withBillingLock,
} from "../_shared/billing-lock.ts";

const confirmationSchema = z.object({ confirmation: z.literal("OBRIŠI") })
  .strict();
const sessionSchema = z.object({ session_id: z.string().uuid() });

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "DELETE_FAILED" }, 500);
    }

    const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)
      ?.[1];
    if (!token) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!confirmationSchema.safeParse(body).success) {
      return json({ error: "INVALID_CONFIRMATION" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    // Read the session ID only from the token verified by Auth above.
    const payload = token.split(".")[1];
    const session = sessionSchema.safeParse(
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))),
    );
    if (!session.success) {
      return json({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
    }

    const admin = createBillingAdmin(supabaseUrl, serviceRoleKey);
    return await withBillingLock(
      admin,
      `customer:${user.id}`,
      async (token) => {
        const params = {
          p_user_id: user.id,
          p_session_id: session.data.session_id,
          p_token: token,
        };
        const preflight = await admin.rpc(
          "authorize_billing_account_deletion",
          params,
        );
        if (preflight.error) return json({ error: "DELETE_FAILED" }, 500);
        if (preflight.data !== true) {
          return json({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
        }

        const profile = await admin.from("profiles").select(
          "paddle_customer_id",
        ).eq("id", user.id).maybeSingle();
        if (profile.error) return json({ error: "DELETE_FAILED" }, 500);
        const customerId = profile.data?.paddle_customer_id;
        if (customerId) {
          const api = paddleApi((key) => Deno.env.get(key));
          for await (const checkout of pendingSignupTransactions(api, customerId)) {
            await cancelPendingTransaction(api, checkout);
          }
          for await (const subscription of customerSubscriptions(api, customerId)) {
            if (subscription.status === "canceled") continue;
            await api.post(`/subscriptions/${subscription.id}/cancel`, { effective_from: "immediately" });
          }
        }

        const { data: deleted, error } = await admin.rpc(
          "delete_billing_account",
          params,
        );

        if (error) {
          console.error("Account deletion failed", error.code);
          return json({ error: "DELETE_FAILED" }, 500);
        }
        if (deleted !== true) {
          return json({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
        }
        return json({ success: true });
      },
    );
  } catch (error) {
    if (error instanceof BillingBusyError) {
      return json({ error: "BILLING_BUSY" }, 409);
    }
    return json({ error: "DELETE_FAILED" }, 500);
  }
});
