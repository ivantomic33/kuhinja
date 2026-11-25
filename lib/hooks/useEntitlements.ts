"use client";

import { useQuery } from "@tanstack/react-query";
import { entitlementSchema } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/client";

export const ENTITLEMENTS_QUERY_KEY = ["profile", "entitlements"] as const;

export function useEntitlements(enabled = true) {
  return useQuery({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase.rpc("get_entitlements", { p_user_id: auth.user.id });
      if (error) throw error;
      return entitlementSchema.parse(data);
    },
  });
}
