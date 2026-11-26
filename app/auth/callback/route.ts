import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { persistPendingLegalConsent } from "@/lib/legal/consent";
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = z.string().trim().min(1).max(512).safeParse(searchParams.get("code")).data;
  const redirectPath = z.string().max(500).safeParse(searchParams.get("next")).data;
  const next = safeRedirectPath(redirectPath ?? null);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // The exchange response comes from Auth and supplies the verified user.
    const user = data.user;
    if (!error && user) {
      if (!(await persistPendingLegalConsent(supabase, user))) {
        if (next === "/reset-password") {
          return NextResponse.redirect(`${origin}${next}`);
        }
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.redirect(`${origin}/login?consent=retry`);
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
