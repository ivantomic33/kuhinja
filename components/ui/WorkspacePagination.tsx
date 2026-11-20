"use client";

import { useRef, useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const PAGE_SIZE = 25;

export function useWorkspacePagination<T>(items: T[]) {
  const [requestedPage, setRequestedPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageCount = items.length > 50 ? Math.ceil(items.length / PAGE_SIZE) : 1;
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
    visible: pageCount === 1 ? items : items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
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
