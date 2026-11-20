import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ensure a venue exists using the signed-in user's JWT + RLS
 * (owner_id must equal auth.uid()). No service_role key.
 */
async function ensureVenueForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  venueName?: string | null,
) {
  try {
    const { data: existing } = await supabase
      .from("venues")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (existing) return;

    const name =
      (typeof venueName === "string" && venueName.trim()) || "Moj lokal";

    await supabase.from("venues").insert({
      owner_id: userId,
      name,
    });
  } catch (err) {
    console.error("Failed to ensure venue after auth callback:", err);
  }
}

/** Only same-origin relative paths — block open redirects. */
function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/dashboard";
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next") ?? "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Re-verify with getUser() after exchange — never trust session alone.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(`${origin}/login`);
      }

      const meta = user.user_metadata ?? {};
      const venueName =
        (meta.venue_name as string | undefined) ||
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        user.email?.split("@")[0];

      // Email/password signup already inserts a venue; OAuth users may not have one.
      // owner_id always comes from verified user id — never from query/body.
      // Uses the user JWT + RLS (no service_role).
      await ensureVenueForUser(supabase, user.id, venueName);

      // Email confirmation links land on /login — send confirmed users home instead.
      const destination =
        next === "/login" || next === "/register" ? "/dashboard" : next;

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
