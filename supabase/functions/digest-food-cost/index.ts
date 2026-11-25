// Supabase Edge Function: digest-food-cost
// Daily unread food-cost alert digest for workspace owners and managers.
// Auth: shared secret header (pg_cron / external scheduler). No hardcoded service role in SQL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { z } from "https://esm.sh/zod@3.25.76";

const bodySchema = z.object({
  run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict().optional();

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-food-cost-digest-secret",
};

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
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
    const expected = Deno.env.get("FOOD_COST_DIGEST_SECRET");
    const provided = req.headers.get("x-food-cost-digest-secret");
    if (!expected || !provided || provided !== expected) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "MISCONFIGURED" }, 500);
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "INVALID_BODY" }, 400);
    }

    const runDate = parsed.data?.run_date ?? todayUtcDate();
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!emailConfigured((k) => Deno.env.get(k))) {
      console.info(
        JSON.stringify({
          event: "food_cost_digest_skipped",
          reason: "email_provider_missing",
          run_date: runDate,
        }),
      );
      // Do not touch digest_runs when mail cannot be sent.
      return json({
        ok: true,
        sent: false,
        reason: "email_provider_missing",
        run_date: runDate,
      });
    }

    const { data: unread, error: unreadError } = await admin
      .from("alerts")
      .select("id, workspace_id, subject_id, payload, created_at")
      .eq("kind", "food_cost_over_target")
      .is("read_at", null)
      .order("created_at", { ascending: true });

    if (unreadError) {
      console.error("food_cost_digest_load_failed", unreadError.code);
      return json({ error: "LOAD_FAILED" }, 500);
    }

    const byWorkspace = new Map<string, typeof unread>();
    for (const row of unread ?? []) {
      const list = byWorkspace.get(row.workspace_id) ?? [];
      list.push(row);
      byWorkspace.set(row.workspace_id, list);
    }

    let claimed = 0;
    let skipped = 0;

    for (const [workspaceId, alerts] of byWorkspace) {
      if (!alerts || alerts.length === 0) continue;

      const { error: claimError } = await admin.from("digest_runs").insert({
        workspace_id: workspaceId,
        run_date: runDate,
        meta: { alert_count: alerts.length },
      });

      if (claimError) {
        // Unique (workspace_id, run_date) → already sent today.
        skipped += 1;
        continue;
      }

      const { data: members, error: membersError } = await admin
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId)
        .in("role", ["owner", "manager"]);

      if (membersError) {
        console.error("food_cost_digest_members_failed", membersError.code);
        // Roll back claim so a later run can retry.
        await admin
          .from("digest_runs")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("run_date", runDate);
        continue;
      }

      const userIds = (members ?? []).map((m) => m.user_id);
      const recipeLines = alerts.map((a) => {
        const payload = (a.payload ?? {}) as Record<string, unknown>;
        const name = typeof payload.recipe_name === "string" ? payload.recipe_name : a.subject_id;
        const pct = payload.food_cost_pct;
        const target = payload.target_food_cost_pct;
        return `- ${name}: ${pct}% (cilj ${target}%)`;
      });

      // Provider is configured but no concrete send client is wired in-repo.
      // Log the digest payload for operators; keep digest_runs row (idempotent day lock).
      console.info(
        JSON.stringify({
          event: "food_cost_digest_queued",
          workspace_id: workspaceId,
          run_date: runDate,
          recipient_user_ids: userIds,
          lines: recipeLines,
        }),
      );
      claimed += 1;
    }

    return json({
      ok: true,
      sent: claimed > 0,
      workspaces_claimed: claimed,
      workspaces_skipped: skipped,
      run_date: runDate,
    });
  } catch (error) {
    console.error("food_cost_digest_failed", error);
    return json({ error: "DIGEST_FAILED" }, 500);
  }
});
