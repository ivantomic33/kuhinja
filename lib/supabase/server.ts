import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

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
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
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

export const getServerUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
