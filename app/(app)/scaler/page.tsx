import { Scale } from "lucide-react";
import { RoutePicker, StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { createClient } from "@/lib/supabase/server";

export default async function ScalerIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("id, name").order("name");
  if (error) throw error;
  return <RoutePicker title={sr.scaler.title} description={sr.listStates.scaler.description} href="/scaler"
    rows={data ?? []} emptyLabel={sr.listStates.scaler.empty} icon={<Scale />}
    action={<StateLink href="/recipes">{sr.listStates.openRecipes}</StateLink>} />;
}
