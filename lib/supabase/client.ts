import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getBrowserCookieOptions } from "@/lib/supabase/cookie-options";

type BrowserClient = SupabaseClient<Database>;

let browserClient: BrowserClient | null = null;

/**
 * Shared browser Supabase client (singleton).
 * Avoids recreating GoTrue/realtime state on every call.
 */
export function createClient(): BrowserClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: getBrowserCookieOptions() },
    // SSR 0.6 uses the older SupabaseClient generic argument order.
  ) as unknown as BrowserClient;

  return browserClient;
}

/** Drop the singleton after sign-out so the next user gets a fresh client. */
export function resetBrowserClient(): void {
  browserClient = null;
}
