import { ListLoading } from "@/components/ui/RouteStates";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/Skeleton";
import { sr } from "@/lib/i18n/sr";
import "@/components/schedule/schedule-workspace.css";
import "@/components/schedule/schedule-grid.css";

const copy = sr.listStates.schedule;

function WeekToolbarSkeleton() {
  return (
    <div className="r-toolbar">
      <div className="r-weeknav">
        <Skeleton className="size-11" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="size-11" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

export default function ScheduleLoading() {
  return (
    <ListLoading title={copy.title} className="r-screen flex flex-col gap-5">
      <header className="r-header">
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.description}<span className="r-sub-desk"> {copy.editHint}</span></p>
        </div>
        <div className="r-actions">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-36" />
        </div>
      </header>
      <div className="r-usage">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>
      <KpiSkeletonRow className="r-kpis" />
      <div className="r-week-card">
        <WeekToolbarSkeleton />
        <div className="r-schedule-grid">
          <div className="r-desktop">
            <div className="r-grid-wrap app-scroll">
              <table className="r-grid" aria-hidden="true">
                <tbody>
                  {Array.from({ length: 4 }, (_, row) => (
                    <tr key={row}>
                      {Array.from({ length: 9 }, (_, column) => (
                        <td key={column}><Skeleton className={row === 0 ? "h-8" : "h-12"} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="r-mobile">
            <div className="grid gap-3 rounded-b-xl border border-border bg-surface p-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    </ListLoading>
  );
}
