import { redirect } from "next/navigation";
import { hasRequiredConsents } from "@/lib/legal/consent";
import { createClient, getServerUser } from "@/lib/supabase/server";

export async function requireCheckoutUser(href: string) {
  const next = encodeURIComponent(href);
  const user = await getServerUser();
  if (!user) redirect(`/login?next=${next}`);

  const supabase = await createClient();
  if (user.app_metadata?.provider === "google" && !(await hasRequiredConsents(supabase, user.id))) {
    redirect(`/auth/legal-consent?next=${next}`);
  }
  return supabase;
}
