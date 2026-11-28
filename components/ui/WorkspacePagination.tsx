"use client";

import { useRef, useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

/** Client page size for long workspace lists (ingredients and similar). */
export const WORKSPACE_PAGE_SIZE = 50;

export function useWorkspacePagination<T>(items: T[], pageSize = WORKSPACE_PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageCount = items.length > pageSize ? Math.ceil(items.length / pageSize) : 1;
  const page = Math.min(requestedPage, pageCount - 1);
  if (page !== requestedPage) setRequestedPage(page);

  function goToPage(next: number) {
    scrollRef.current?.scrollTo({ top: 0 });
    setRequestedPage(next);
  }

  return {
    page,
    pageCount,
    goToPage,
    scrollRef,
    visible: pageCount === 1 ? items : items.slice(page * pageSize, (page + 1) * pageSize),
  };
}

export function WorkspacePagination({
  page,
  pageCount,
  goToPage,
}: {
  page: number;
  pageCount: number;
  goToPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Stranice rezultata" className="flex w-full flex-wrap items-center justify-between gap-2">
      <PrimaryButton variant="secondary" disabled={page === 0} onClick={() => goToPage(page - 1)}>
        Prethodna
      </PrimaryButton>
      <span aria-live="polite" className="text-sm tabular-nums text-muted">{page + 1} / {pageCount}</span>
      <PrimaryButton variant="secondary" disabled={page === pageCount - 1} onClick={() => goToPage(page + 1)}>
        Sledeća
      </PrimaryButton>
    </nav>
  );
}
