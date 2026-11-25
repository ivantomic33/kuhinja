"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CloudOff } from "lucide-react";
import { useOnline } from "@/lib/hooks/useOnline";
import { DEAD_LETTERS_CHANGED, listDeadLetters } from "@/lib/offline/idb";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type OfflineIndicatorProps = {
  className?: string;
};

/** Compact top-bar badge: offline state and dead-letter queue warnings. */
export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const online = useOnline(true);
  const [deadCount, setDeadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;

    async function refresh() {
      const current = ++revision;
      try {
        const dead = await listDeadLetters();
        if (!cancelled && current === revision) setDeadCount(dead.length);
      } catch {
        // Keep the last known warning while storage is temporarily unavailable.
      }
    }

    void refresh();
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener(DEAD_LETTERS_CHANGED, onOnline);
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener(DEAD_LETTERS_CHANGED, onOnline);
      window.clearInterval(id);
    };
  }, []);

  if (online && deadCount === 0) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {!online ? (
        <span
          role="status"
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-surface-2 px-2 text-xs font-medium text-muted"
        >
          <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{sr.pwa.offline}</span>
        </span>
      ) : null}
      {deadCount > 0 ? (
        <span
          role="status"
          title={sr.pwa.deadLetterHint}
          className="inline-flex h-8 max-w-[14rem] items-center gap-1 rounded-[var(--radius-pill)] border border-warning/40 bg-warning/10 px-2 text-xs font-medium text-warning"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {sr.pwa.deadLetterWarning}
            {deadCount > 1 ? ` (${deadCount})` : ""}
          </span>
        </span>
      ) : null}
    </span>
  );
}
