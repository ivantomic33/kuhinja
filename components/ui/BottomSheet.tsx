"use client";

import {
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { useDialogFocus } from "./useDialogFocus";

export type BottomSheetProps = {
  id?: string;
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Optional subtitle / limit meter under title */
  description?: ReactNode;
  children: ReactNode;
  /** Sticky footer (actions) */
  footer?: ReactNode;
  /** Wider panel for two-column forms */
  size?: "md" | "lg";
  /** Optional class for the panel */
  className?: string;
  /** Trigger for a sheet that mounts after a loading dialog. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function BottomSheet({
  id,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  returnFocusRef,
}: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open, onClose, panelRef, returnFocusRef });
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        data-motion-surface
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 border-0 bg-background/70 motion-safe:animate-[dialog-enter_150ms_ease-out] md:backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        data-motion-surface
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? sr.ui.bottomSheet.dialogLabel}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col motion-safe:animate-[dialog-enter_180ms_ease-out]",
          "border border-border bg-surface text-text shadow-2xl",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-xl)] border-b-0",
          "bottom-sheet-safe",
          "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:right-auto",
          "md:max-h-[min(90dvh,840px)] md:-translate-x-1/2 md:-translate-y-1/2",
          "md:rounded-[var(--radius-xl)] md:border-b",
          size === "md" && "md:w-[min(100%-32px,560px)]",
          size === "lg" && "md:w-[min(100%-32px,720px)]",
          className
        )}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-[var(--radius-pill)] bg-border md:hidden" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-text"
              >
                {title}
              </h2>
            ) : (
              <span className="sr-only">{sr.ui.bottomSheet.dialogLabel}</span>
            )}
            {description ? (
              <div className="mt-1 text-sm text-muted">{description}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={sr.ui.bottomSheet.closeAria}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
              "text-muted hover:bg-surface-2 hover:text-text",
              "focus-ring outline-none"
            )}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 [&_form]:gap-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
