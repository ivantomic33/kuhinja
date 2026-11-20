import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { ScheduleWorkspace } from "@/components/schedule/ScheduleWorkspace";
import { BentoCard } from "@/components/ui/BentoCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadSchedule } from "@/lib/schedule/server";
import { getPlan } from "@/lib/supabase/plan-server";

type SchedulePageProps = { searchParams: Promise<{ lokal?: string; nedelja?: string }> };

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const { lokal, nedelja } = await searchParams;
  const result = await loadSchedule(lokal, nedelja).then(
    (data) => ({ data, failed: false }),
    () => ({ data: null, failed: true }),
  );
  if (result.data?.plan === "free" || (!result.data && (await getPlan()) === "free")) {
    return (
      <>
        <PageHeader title="Raspored" />
        <BentoCard>
          <Lock className="size-5 text-accent" aria-hidden="true" />
          <p>Raspored smena je dostupan od Starter paketa.</p>
          <Link href="/premium" className="w-fit rounded-[10px] border border-border-strong bg-surface-2 px-4 py-3 text-sm font-semibold hover:bg-surface-3">
            Pogledaj planove
          </Link>
        </BentoCard>
      </>
    );
  }
  if (result.failed) {
    return <p role="alert" className="rounded-xl border border-danger/30 bg-surface p-5 text-danger">Raspored nije učitan. Osveži stranicu.</p>;
  }
  if (!result.data) notFound();
  return <ScheduleWorkspace key={result.data.venue.id} data={result.data} />;
}
