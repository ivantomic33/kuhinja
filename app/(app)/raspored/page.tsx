import { CalendarDays, Lock } from "lucide-react";
import { ScheduleWorkspace } from "@/components/schedule/ScheduleWorkspace";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { loadSchedule } from "@/lib/schedule/server";
import { getPlan } from "@/lib/supabase/plan-server";

type SchedulePageProps = { searchParams: Promise<{ lokal?: string; nedelja?: string }> };
const copy = sr.listStates.schedule;

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const { lokal, nedelja } = await searchParams;
  const data = await loadSchedule(lokal, nedelja);
  if ((data?.plan ?? await getPlan()) === "free") {
    return (
      <>
        <PageHeader title={copy.title} />
        <BentoCard>
          <EmptyState icon={<Lock />} title={copy.locked}
            action={<StateLink href="/premium">{copy.plans}</StateLink>} />
        </BentoCard>
      </>
    );
  }
  if (!data) return <><PageHeader title={copy.title} /><EmptyState icon={<CalendarDays />} title={copy.noVenue}
    action={<StateLink href="/dashboard">{sr.pwa.openDashboard}</StateLink>} /></>;
  return <ScheduleWorkspace key={data.venue.id} data={data} />;
}
