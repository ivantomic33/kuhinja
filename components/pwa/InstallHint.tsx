"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import {
  bumpVisitCount,
  dismissInstallHint,
  isInstallHintDismissed,
} from "@/lib/pwa/visits";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type InstallHintProps = {
  className?: string;
};

/**
 * After the second visit, show a dismissible “add to home screen” hint.
 * Dismissal is permanent (localStorage).
 */
export function InstallHint({ className }: InstallHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstallHintDismissed()) return;
    const visits = bumpVisitCount();
    if (visits >= 2) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-2 py-2 motion-safe:transition-opacity",
        className
      )}
    >
      <Smartphone className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <p className="flex-1 text-sm text-text">{sr.pwa.installHint}</p>
      <button
        type="button"
        onClick={() => {
          dismissInstallHint();
          setVisible(false);
        }}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-[var(--radius-input)]",
          "text-muted hover:bg-surface-2 hover:text-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
        aria-label={sr.pwa.dismissInstallHint}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
