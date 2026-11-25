import type { ReactNode } from "react";
import ProtectedAppShell from "@/components/layout/ProtectedAppShell";
import { getServerUser } from "@/lib/supabase/server";

/**
 * /premium is public for guests and shell-wrapped for signed-in users.
 * Keep the shell in the route layout (not imported into the page tree) so
 * client components like PremiumPage stay in this route's client manifest.
 */
export default async function PremiumLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) return children;
  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
