import { RoutePicker, StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { createClient } from "@/lib/supabase/server";

export default async function ScalerIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("id, name").order("name");
  if (error) throw error;
  return <RoutePicker title={sr.scaler.title} description="Izaberite recept za skaliranje." href="/scaler"
    rows={data ?? []} emptyLabel="Još nema recepata za skaliranje."
    action={<StateLink href="/recipes">Otvori recepte</StateLink>} />;
}
