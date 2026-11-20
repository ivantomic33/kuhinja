import { PageHeader } from "@/components/ui/PageHeader";
import { KpiSkeletonRow, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { stockSr as t } from "@/lib/i18n/stock";

export default function StockLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeader title={t.title} description={t.subtitle} className="!mb-0" />
      <Skeleton className="h-12" />
      <KpiSkeletonRow />
      <TableSkeleton />
    </div>
  );
}
