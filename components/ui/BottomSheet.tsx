"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

let scrollLocks = 0;
let originalBodyOverflow = "";

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
}: BottomSheetProps) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    if (dialogs[dialogs.length - 1] !== panelRef.current) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key === "Tab" && panelRef.current) {
      const elements = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      )).filter((element) => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (!first) {
        event.preventDefault();
        panelRef.current.focus();
      } else if (event.shiftKey && (active === first || !elements.includes(active as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !elements.includes(active as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    if (scrollLocks === 0) originalBodyOverflow = document.body.style.overflow;
    scrollLocks += 1;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (
        panelRef.current &&
        (!active || !panelRef.current.contains(active))
      ) {
        panelRef.current.focus();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = originalBodyOverflow;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      const top = dialogs[dialogs.length - 1];
      const previous = previouslyFocused.current;
      if (previous?.isConnected && (!top || top === panel || top.contains(previous))) previous.focus();
    };
  }, [open, handleKeyDown]);

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={sr.ui.bottomSheet.closeAria}
            className="absolute inset-0 border-0 bg-background/70 md:backdrop-blur-sm"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            onClick={onClose}
          />

          {/* Mobile: bottom sheet · Desktop: centered dialog */}
          <motion.div
            id={id}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? sr.ui.bottomSheet.dialogLabel}
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn(
              "absolute flex flex-col outline-none",
              "border border-border bg-surface text-text shadow-2xl",
              // Mobile bottom sheet
              "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-xl)] border-b-0",
              "pb-[max(0px,env(safe-area-inset-bottom))]",
              // Desktop modal
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:right-auto",
              "md:max-h-[min(90dvh,840px)] md:-translate-x-1/2 md:-translate-y-1/2",
              "md:rounded-[var(--radius-xl)] md:border-b",
              size === "md" && "md:w-[min(100%-32px,560px)]",
              size === "lg" && "md:w-[min(100%-32px,720px)]",
              className
            )}
            initial={
              reduceMotion
                ? false
                : { y: "100%", opacity: 0.8 }
            }
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: "100%", opacity: 0 }}
            transition={spring}
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
                  "focus-visible:ring-2 focus-visible:ring-accent outline-none"
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
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
