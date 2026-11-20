import { createClient } from "@/lib/supabase/client";

/** Resolve the current user's primary venue id (oldest first). */
export async function getPrimaryVenueId(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0]?.id ?? null;
}
