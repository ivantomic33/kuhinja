"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CircleHelp } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type FieldHelpProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Compact "?" control that opens a short explanation on tap, Enter, or Space.
 * Closes on Escape, outside click, or a second toggle.
 */
export function FieldHelp({ label, children, className }: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function toggle() {
    setOpen((value) => !value);
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
  }

  return (
    <span ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className={cn(
          "focus-ring inline-flex size-7 items-center justify-center rounded-full",
          "border border-border bg-surface-2 text-text-2 hover:bg-surface-3 hover:text-text",
        )}
        aria-label={sr.onboarding.fieldHelp.ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={cn(
            "absolute left-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border",
            "bg-surface p-3 text-left shadow-lg",
          )}
        >
          <span id={titleId} className="sr-only">
            {label}
          </span>
          <span className="block text-sm leading-relaxed text-text-2">{children}</span>
        </span>
      ) : null}
    </span>
  );
}
