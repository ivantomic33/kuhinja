import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchedulePreview } from "@/components/schedule/SchedulePreview";
import { getSchedulePreview, scheduleShareToken } from "@/lib/schedule/exports-preview";
import { loadPublicSchedule } from "@/lib/schedule/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raspored",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const token = scheduleShareToken((await params).token);
  if (!token) notFound();
  const schedule = await loadPublicSchedule(token);
  if (!schedule) notFound();

  return (
    <main className="r-public">
      <SchedulePreview preview={getSchedulePreview(schedule)} titleId="schedule-preview-title" titleAs="h1" />
    </main>
  );
}
