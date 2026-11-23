import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * @param requestHeaders - Optional mutated request headers (e.g. x-nonce for CSP).
 *   When set, forwarded on every NextResponse.next so Server Components see them.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
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
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = nextWithHeaders();
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, supabaseResponse, user };
}
