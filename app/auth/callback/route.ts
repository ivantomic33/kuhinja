import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function ensureVenueForUser(userId: string, venueName?: string | null) {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("venues")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (existing) return;

    const name =
      (typeof venueName === "string" && venueName.trim()) || "Moj lokal";

    await admin.from("venues").insert({
      owner_id: userId,
      name,
    });
  } catch (err) {
    console.error("Failed to ensure venue after auth callback:", err);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const meta = data.user.user_metadata ?? {};
      const venueName =
        (meta.venue_name as string | undefined) ||
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        data.user.email?.split("@")[0];

      // Email/password signup already inserts a venue; OAuth users may not have one.
      await ensureVenueForUser(data.user.id, venueName);

      // Email confirmation links land on /login — send confirmed users home instead.
      const destination =
        safeNext === "/login" || safeNext === "/register"
          ? "/dashboard"
          : safeNext;

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
