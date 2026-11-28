import { getEntitlement } from "@/lib/billing/entitlements";
import { paddleSdk } from "@/lib/paddle/sdk";
import { requireActionUser } from "@/lib/server/action";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireActionUser();
  if ("error" in auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const { paddleCustomerId } = await getEntitlement(auth.supabase, auth.user.id);
    if (!paddleCustomerId) return Response.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });

    const session = await paddleSdk().customerPortalSessions.create(paddleCustomerId);
    return Response.json({ url: session.urls.general.overview }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Paddle portal session failed");
    return Response.json({ error: "PORTAL_FAILED" }, { status: 502 });
  }
}
