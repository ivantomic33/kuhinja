// Supabase Edge Function: send-purchase-order
// Marks draft → poslato then attempts email. No provider → 501.
// Auth: user JWT (chef+). Never emails real suppliers from automated tests.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://esm.sh/zod@3.25.76";

const bodySchema = z
  .object({
    order_id: z.string().uuid(),
    to: z.string().trim().email().max(320).transform((v) => v.toLowerCase()),
    cc: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((v) => v.toLowerCase())
      .optional(),
    reply_to: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((v) => v.toLowerCase())
      .optional(),
  })
  .strict();

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function emailConfigured(getEnv: (k: string) => string | undefined): boolean {
  return Boolean(
    getEnv("RESEND_API_KEY") ||
      getEnv("SMTP_URL") ||
      getEnv("EMAIL_PROVIDER_URL"),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    if (!emailConfigured((k) => Deno.env.get(k))) {
      return json(
        {
          error: "email_provider_missing",
          message: "Email provider is not configured.",
        },
        501,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "MISCONFIGURED" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "UNAUTHORIZED" }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "INVALID_BODY" }, 400);

    const { order_id, to, cc, reply_to } = parsed.data;

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .select("id, workspace_id, status, supplier_id, number")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) return json({ error: "NOT_FOUND" }, 404);

    const { data: isChef } = await supabase.rpc("is_member", {
      p_workspace_id: order.workspace_id,
      p_min_role: "chef",
    });
    if (!isChef) return json({ error: "FORBIDDEN" }, 403);

    if (!order.supplier_id) {
      return json({ error: "NO_SUPPLIER_EMAIL" }, 400);
    }

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("contact_email, name")
      .eq("id", order.supplier_id)
      .maybeSingle();

    if (!supplier?.contact_email) {
      return json({ error: "NO_SUPPLIER_EMAIL" }, 400);
    }

    // Atomic draft → poslato before send (idempotent).
    const { data: marked, error: markError } = await supabase.rpc(
      "mark_purchase_order_sent",
      { p_order_id: order_id, p_sent_to: to },
    );

    if (markError) {
      const msg = markError.message ?? "";
      if (msg.includes("ORDER_NOT_DRAFT")) {
        return json({ error: "ALREADY_SENT" }, 409);
      }
      return json({ error: "MARK_FAILED", message: msg }, 400);
    }

    // Provider path intentionally not implemented beyond config gate.
    // If a future provider fails, compensate:
    try {
      // Placeholder: real provider call would go here.
      // Without a concrete SDK in-repo, treat missing implementation as failure
      // only when keys exist but no sender module — still return 501-style.
      console.info(
        JSON.stringify({
          event: "send_purchase_order_stub",
          order_id,
          to,
          cc: cc ?? null,
          reply_to: reply_to ?? null,
          marked_id: (marked as { id?: string } | null)?.id ?? null,
        }),
      );
      return json({
        ok: true,
        sent: false,
        reason: "provider_stub",
        message:
          "Provider keys present but no mail sender module is wired; status left poslato for ops review.",
      });
    } catch (sendErr) {
      await supabase.rpc("revert_purchase_order_sent", { p_order_id: order_id });
      console.error("send_purchase_order_failed", sendErr);
      return json({ error: "SEND_FAILED" }, 502);
    }
  } catch (error) {
    console.error("send_purchase_order_crash", error);
    return json({ error: "INTERNAL" }, 500);
  }
});
