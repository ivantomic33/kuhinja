// Supabase Edge Function: delete-account
// Verifies the caller before invoking the service-role-only deletion transaction.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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

    const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (body?.confirmation !== "OBRIŠI") {
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
    const { session_id: sessionId } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof sessionId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return json({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: deleted, error } = await admin.rpc("delete_account", {
      p_user_id: user.id,
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Account deletion failed", error.code);
      return json({ error: "DELETE_FAILED" }, 500);
    }
    if (deleted !== true) {
      return json({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
    }
    return json({ success: true });
  } catch {
    return json({ error: "DELETE_FAILED" }, 500);
  }
});
