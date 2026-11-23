"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { DashboardPreviewCard, dashboardRowClass } from "@/components/dashboard/DashboardLayout";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import { getCachedTemplateSummaries, type CachedTemplateSummary } from "@/lib/offline/cache";

export type TemplateRow = CachedTemplateSummary & {
  itemCount?: number;
  totalMinutes?: number;
};

export function ShiftTemplatesCard({ initialTemplates, count, onRequestCreate }: {
  initialTemplates: TemplateRow[];
  count: number | null;
  onRequestCreate: () => void;
}) {
  const online = useOnline(true);
  const [cached, setCached] = useState<TemplateRow[] | null>(null);

  useEffect(() => {
    if (online) return;
    void getCachedTemplateSummaries().then(setCached);
  }, [online]);

  const templates = !online && cached?.length ? cached : initialTemplates;
  const shown = templates.slice(0, 3);

  return (
    <DashboardPreviewCard
      title={sr.dashboard.shiftPreview}
      count={online ? count : templates.length}
      href="/shift"
      onAdd={onRequestCreate}
      addLabel={sr.listStates.shift.create}
      emptyTitle={sr.listStates.shift.empty}
      emptyIcon={<ClipboardList />}
      hasItems={shown.length > 0}
    >
      {shown.map((template) => (
        <li key={template.id}>
          <Link href={`/shift/${template.id}`} className={`${dashboardRowClass} hover:bg-surface-3`}>
            <ClipboardList className="size-4 shrink-0 text-text-2" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-text">{template.name}</p>
              {template.itemCount !== undefined ? (
                <p className="truncate text-ui-xs text-text-2">
                  {template.itemCount} stavki
                  {template.totalMinutes !== undefined ? ` · ${template.totalMinutes} min` : null}
                </p>
              ) : null}
            </div>
            <ArrowRight className="size-4 shrink-0 text-text-2" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </DashboardPreviewCard>
  );
}
