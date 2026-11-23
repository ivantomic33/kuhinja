import { cn } from "@/lib/utils/cn";

export type SkeletonProps = {
  className?: string;
};

/** Loading placeholder — prefer over spinners for page content. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[var(--radius-md)] bg-surface-2 motion-safe:animate-pulse",
        className
      )}
    />
  );
}

export function KpiSkeletonRow({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-36 min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, stacked = false, className }: {
  rows?: number;
  stacked?: boolean;
  className?: string;
}) {
  const columns = stacked ? 6 : 7;
  const grid = stacked ? "grid-cols-[2.75rem_minmax(0,2fr)_repeat(4,minmax(0,1fr))]" : "grid-cols-[2fr_repeat(6,minmax(0,1fr))]";
  return (
    <>
      <div aria-hidden="true" className={cn("overflow-hidden", stacked && "hidden md:block")}>
        <div className={className}>
          <div className={cn("grid h-12 items-center gap-2 bg-surface-2 px-4", grid)}>
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className={cn("bg-elevated!", stacked && column === 0 ? "size-4" : "h-3 w-3/4")} />
            ))}
          </div>
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className={cn("grid h-16 items-center gap-2 border-b border-border px-4 last:border-0", grid)}>
              {Array.from({ length: columns }, (_, column) => (
                <Skeleton key={column} className={stacked && column === 0 ? "size-4" : "h-4 w-3/4"} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {stacked ? <div aria-hidden="true" className="grid gap-3 p-3 md:hidden">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid min-h-56 content-between gap-3 rounded-lg border border-border bg-background p-3">
            <Skeleton className="ml-auto h-7 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-11 w-24" />
          </div>
        ))}
      </div> : null}
    </>
  );
}
