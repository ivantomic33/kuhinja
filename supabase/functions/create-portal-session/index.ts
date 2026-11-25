import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { paddleApi } from "../_shared/paddle.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const readEnv = (key: string) => Deno.env.get(key);

function json(status: number, body: object) {
  return Response.json(body, { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json(401, { error: "UNAUTHORIZED" });
  const url = readEnv("SUPABASE_URL");
  const anonKey = readEnv("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return json(503, { error: "BILLING_UNAVAILABLE" });
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return json(401, { error: "UNAUTHORIZED" });
    const profile = await supabase.from("profiles").select("paddle_customer_id").eq("id", user.id).single();
    if (profile.error) return json(503, { error: "PROFILE_UNAVAILABLE" });
    const customerId = profile.data?.paddle_customer_id;
    if (!customerId) return json(404, { error: "CUSTOMER_NOT_FOUND" });

    const api = paddleApi(readEnv);
    const session = await api.post<{ urls: { general: { overview: string } } }>(
      `/customers/${customerId}/portal-sessions`, {},
    );
    return json(200, { url: session.urls.general.overview });
  } catch (error) {
    console.error("Paddle portal failed", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "PORTAL_FAILED" });
  }
});
