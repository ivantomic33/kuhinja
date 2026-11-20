import { RoutePicker, StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { createClient } from "@/lib/supabase/server";

export default async function ShiftIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_templates").select("id, name").order("name");
  if (error) throw error;
  return <RoutePicker title={sr.shift.title} description="Izaberite šablon za pripremu smene." href="/shift"
    rows={data ?? []} emptyLabel="Još nema šablona smene."
    action={<StateLink href="/dashboard">Otvori tablu</StateLink>} />;
}
