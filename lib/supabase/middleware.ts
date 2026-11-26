import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseCookieOptions, mergeSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * @param requestHeaders - Optional mutated request headers (e.g. x-nonce for CSP).
 *   When set, forwarded on every NextResponse.next so Server Components see them.
 * @param authCheck - Use verified JWT claims when routing only needs a session identity.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
  authCheck: "user" | "claims" = "user",
) {
  const nextWithHeaders = () =>
    NextResponse.next(
      requestHeaders
        ? {
            request: {
              headers: requestHeaders,
            },
          }
        : { request },
    );

  let supabaseResponse = nextWithHeaders();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          requestHeaders?.set("cookie", request.cookies.toString());
          supabaseResponse = nextWithHeaders();
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, mergeSupabaseCookieOptions(options));
          });
        },
      },
    }
  );

  if (authCheck === "claims") {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const user = !error && claims?.sub && claims.role === "authenticated"
      ? { id: claims.sub }
      : null;
    return { supabase, supabaseResponse, user };
  }

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, supabaseResponse, user };
}
