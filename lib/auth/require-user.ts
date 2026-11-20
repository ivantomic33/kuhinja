import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";

/**
 * Second-layer session gate for protected App Router layouts.
 * Middleware default-denies anonymous traffic; this catches edge cases
 * (stale cookies, matcher gaps) before rendering user data.
 */
export async function requireUser() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
