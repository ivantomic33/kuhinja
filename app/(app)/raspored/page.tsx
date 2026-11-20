import { Lock } from "lucide-react";
import { ScheduleWorkspace } from "@/components/schedule/ScheduleWorkspace";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateLink } from "@/components/ui/RouteStates";
import { loadSchedule } from "@/lib/schedule/server";
import { getPlan } from "@/lib/supabase/plan-server";

type SchedulePageProps = { searchParams: Promise<{ lokal?: string; nedelja?: string }> };

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const { lokal, nedelja } = await searchParams;
  const data = await loadSchedule(lokal, nedelja);
  if ((data?.plan ?? await getPlan()) === "free") {
    return (
      <>
        <PageHeader title="Raspored" />
        <BentoCard>
          <EmptyState icon={<Lock />} title="Raspored smena je dostupan od Starter paketa."
            action={<StateLink href="/premium">Pogledaj planove</StateLink>} />
        </BentoCard>
      </>
    );
  }
  if (!data) return <><PageHeader title="Raspored" /><EmptyState title="Nema lokala za raspored."
    action={<StateLink href="/dashboard">Otvori tablu</StateLink>} /></>;
  return <ScheduleWorkspace key={data.venue.id} data={data} />;
}
