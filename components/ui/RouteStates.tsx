import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { BentoCard } from "./BentoCard";
import { PageHeader } from "./PageHeader";
import { Skeleton, TableSkeleton } from "./Skeleton";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

const LINK_VARIANT = {
  primary: "bg-accent text-text-on-accent hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface-2 text-text hover:bg-surface-3",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
} as const;

export function StateLink({ href, children, variant = "primary", fullWidth, prefetch }: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof LINK_VARIANT;
  fullWidth?: boolean;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={cn(
      "focus-ring inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-sm font-semibold",
      LINK_VARIANT[variant],
      fullWidth && "w-full"
    )}>
      {children}
    </Link>
  );
}

export function ListLoading({ title, className, children }: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={sr.listStates.loading(title)} aria-busy="true" className={className}>
      {children}
    </div>
  );
}

const pickerList = "grid max-w-2xl gap-2";

export function PickerSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <ListLoading title={title}>
      <PageHeader title={title} description={description} />
      <div className={pickerList}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex h-11 items-center justify-between rounded-xl border border-border bg-surface px-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="size-4" />
          </div>
        ))}
      </div>
    </ListLoading>
  );
}

export function WorkspaceSkeleton({ title, description, viewToggle = false }: {
  title: string;
  description: string;
  viewToggle?: boolean;
}) {
  return (
    <ListLoading title={title} className="flex min-w-0 flex-col gap-4">
      <PageHeader title={title} description={description} action={<Skeleton className="h-11 w-40" />} />
      <Skeleton className="mb-4 h-12 w-full" />
      <BentoCard flush header={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:justify-between">
          <Skeleton className="h-11 w-full max-w-120 max-[900px]:max-w-none" />
          {viewToggle ? <Skeleton className="hidden h-11 w-52 md:block" /> : null}
        </div>
      } footer={<><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-32" /></>}>
        <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-11 w-44 md:hidden" />
        </div>
        <TableSkeleton rows={3} stacked />
      </BentoCard>
    </ListLoading>
  );
}

export function RoutePicker({ title, description, href, rows, emptyLabel, icon, action }: {
  title: string;
  description: string;
  href: string;
  rows: readonly { id: string; name: string }[];
  emptyLabel: string;
  icon: ReactNode;
  action: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {rows.length === 0 ? <EmptyState icon={icon} title={emptyLabel} action={action} /> : (
        <ul className={cn(pickerList, "motion-card-list")}>
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${href}/${row.id}`} className="focus-ring flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2 font-semibold hover:bg-surface-2">
                <span className="min-w-0 wrap-break-word">{row.name}</span>
                <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div role="status" aria-label={sr.common.loading} aria-busy="true" className="grid gap-4">
      {Array.from({ length: fields }, (_, index) => <Skeleton key={index} className="h-14" />)}
      <Skeleton className="h-11" />
    </div>
  );
}
