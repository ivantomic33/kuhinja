import type { ReactNode } from "react";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { sr } from "@/lib/i18n/sr";

export const dashboardKpiHeight = "h-56 sm:h-48";
const previewHeight = "h-[184px]";
export const dashboardRowClass =
  "flex h-14 min-w-0 items-center gap-2 rounded-lg bg-surface-2 px-3";

export function DashboardLayout({ heading, kpis, children, notice, footer }: {
  heading: ReactNode;
  kpis: ReactNode;
  children: ReactNode;
  notice?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-28 sm:h-20 [&_h1]:truncate">{heading}</div>
      <section aria-label="Ključni pokazatelji" className="grid grid-cols-2 gap-3 min-[1080px]:grid-cols-4 md:gap-4">
        {kpis}
      </section>
      {notice}
      <div className="motion-card-list grid gap-4 min-[1080px]:grid-cols-3">{children}</div>
      {footer}
    </div>
  );
}

export function DashboardPreviewCard({
  title, count, href, onAdd, addLabel, emptyTitle, emptyIcon, hasItems, children,
}: {
  title: string;
  count: number | null;
  href: string;
  onAdd: () => void;
  addLabel: string;
  emptyTitle: string;
  emptyIcon: ReactNode;
  hasItems: boolean;
  children: ReactNode;
}) {
  return (
    <BentoCard
      dense
      header={
        <SectionCardHeader
          title={title}
          count={count ?? undefined}
          href={hasItems ? href : undefined}
          onAdd={hasItems ? onAdd : undefined}
          addLabel={addLabel}
          singleLine
        />
      }
    >
      <div className={previewHeight}>
        {hasItems ? (
          <ul className="grid gap-2">{children}</ul>
        ) : count === null ? (
          <p className="grid h-full place-items-center text-sm text-text-2">{sr.listStates.dashboard.unavailable}</p>
        ) : (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            actionLabel={addLabel}
            onAction={onAdd}
            className="h-full gap-2 px-3 py-3 [&>div:first-child]:size-11"
          />
        )}
      </div>
    </BentoCard>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label={sr.listStates.dashboard.loading} aria-busy="true">
      <DashboardLayout
        heading={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="grid gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-11 w-44" />
          </div>
        }
        kpis={Array.from({ length: 4 }, (_, index) => (
          <BentoCard key={index} className={dashboardKpiHeight}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-9 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
          </BentoCard>
        ))}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <BentoCard key={index} dense header={<Skeleton className="h-11 w-full" />}>
            <div className={`${previewHeight} grid content-start gap-2`}>
              {Array.from({ length: 3 }, (_, row) => (
                <Skeleton key={row} className="h-14 w-full" />
              ))}
            </div>
          </BentoCard>
        ))}
      </DashboardLayout>
    </div>
  );
}
