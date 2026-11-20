import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { Skeleton, TableSkeleton } from "./Skeleton";
import { sr } from "@/lib/i18n/sr";

export function StateLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover">{children}</Link>;
}

export function PageSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <PageHeader title={title} />
      <TableSkeleton rows={3} />
    </div>
  );
}

export function RoutePicker({ title, description, href, rows, emptyLabel, action }: {
  title: string;
  description: string;
  href: string;
  rows: readonly { id: string; name: string }[];
  emptyLabel: string;
  action: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {rows.length === 0 ? <EmptyState title={emptyLabel} action={action} /> : (
        <ul className="grid max-w-2xl gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${href}/${row.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2 font-semibold hover:bg-surface-2">
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
