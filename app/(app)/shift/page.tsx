import { ClipboardList } from "lucide-react";
import { RoutePicker, StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { createClient } from "@/lib/supabase/server";

export default async function ShiftIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_templates").select("id, name").order("name");
  if (error) throw error;
  return <RoutePicker title={sr.shift.title} description={sr.listStates.shift.description} href="/shift"
    rows={data ?? []} emptyLabel={sr.listStates.shift.empty} icon={<ClipboardList />}
    action={<StateLink href="/dashboard">{sr.pwa.openDashboard}</StateLink>} />;
}
