import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseCookieOptions, mergeSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * One Supabase server client per request (React cache).
 * Dedupes cookie reads and client construction across layout + pages.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  // Untyped client avoids brittle generated-table inference (`never` rows)
  // while still using the SSR cookie adapter correctly.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
            });
          } catch {
            // setAll can be called from a Server Component where cookies
            // are read-only. This can be ignored when the middleware
            // refreshes the user session.
          }
        },
      },
    }
  );
});

/** Identity for RLS-protected pages. GoTrue verifies the JWT or falls back to Auth. */
export const getServerUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated") return null;
  return { id: claims.sub, email: claims.email, user_metadata: claims.user_metadata, app_metadata: claims.app_metadata };
});
