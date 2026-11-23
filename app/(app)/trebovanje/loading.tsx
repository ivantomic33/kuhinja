import { BentoCard } from "@/components/ui/BentoCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListLoading } from "@/components/ui/RouteStates";
import { KpiSkeletonRow, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { stockSr as t } from "@/lib/i18n/stock";

export default function StockLoading() {
  return (
    <ListLoading title={t.title} className="stock-page">
      <PageHeader title={t.title} description={t.subtitle} action={
        <>
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-36" />
        </>
      } />
      <Skeleton className="h-12" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-24" />
      </div>
      <KpiSkeletonRow className="stock-kpis" />
      <BentoCard flush header={
        <div className="flex w-full flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-full md:w-2/5" />
          <Skeleton className="h-11 w-36" />
          <Skeleton className="ml-auto h-4 w-28" />
        </div>
      } footer={<Skeleton className="h-5 w-32" />}>
        <TableSkeleton rows={3} className="stock-table" />
      </BentoCard>
    </ListLoading>
  );
}
