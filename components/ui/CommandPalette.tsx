"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import { useDialogFocus } from "./useDialogFocus";

export type CommandItem = {
  id: string;
  label: string;
  /** Optional short hint (≤ 60 chars) */
  hint?: string;
  icon?: ReactNode;
  keywords?: string[];
  onSelect: () => void;
};

export type CommandPaletteProps = {
  items: CommandItem[];
  /** Controlled open state (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra class on the dialog panel */
  className?: string;
};

export function CommandPalette({
  items,
  open: openProp,
  onOpenChange,
  className,
}: CommandPaletteProps) {
  const reduceMotion = usePrefersReducedMotion();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open, onClose: () => setOpen(false), panelRef, initialFocusRef: inputRef });
  const listRef = useRef<HTMLUListElement>(null);
  const titleId = useId();
  const listboxId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [item.label, item.hint, ...(item.keywords ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle =
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey);

      if (isToggle) {
        event.preventDefault();
        setOpen(!open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selectItem = useCallback(
    (item: CommandItem) => {
      item.onSelect();
      setOpen(false);
    },
    [setOpen]
  );

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0
          ? 0
          : (i - 1 + filtered.length) % filtered.length
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) selectItem(item);
      return;
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const fade = reduceMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: "easeOut" as const };

  return (
    <AnimatePresence>
      {open ? (
        <div className="command-palette-position fixed inset-0 z-[60] flex items-start justify-center p-2">
          <motion.button
            data-motion-surface
            type="button"
            tabIndex={-1}
            aria-label={sr.ui.commandPalette.closeAria}
            className="absolute inset-0 border-0 bg-background/60"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={fade}
            onClick={() => setOpen(false)}
          />

          <motion.div
            data-motion-surface
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative z-10 flex w-full max-w-lg flex-col overflow-hidden",
              "rounded-[var(--radius-card)] border border-border bg-surface text-text shadow-xl",
              className
            )}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: -8 }}
            transition={fade}
          >
            <div className="flex items-center gap-2 border-b border-border px-2 py-2">
              <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <h2 id={titleId} className="sr-only">
                {sr.ui.commandPalette.title}
              </h2>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label={sr.ui.commandPalette.placeholder}
                aria-expanded="true"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={sr.ui.commandPalette.placeholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  filtered[activeIndex]
                    ? `${listboxId}-option-${filtered[activeIndex].id}`
                    : undefined
                }
                className={cn(
                  "focus-ring min-h-[44px] w-full flex-1 rounded-lg bg-transparent text-base text-text outline-none",
                  "placeholder:text-muted"
                )}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={sr.ui.commandPalette.closeAria}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-[var(--radius-input)]",
                  "text-muted hover:bg-surface-2 hover:text-text",
                  "focus-visible:ring-2 focus-visible:ring-accent outline-none"
                )}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={sr.ui.commandPalette.title}
              className="max-h-80 overflow-y-auto p-1"
            >
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-sm text-muted" role="option" aria-disabled="true" aria-selected="false">
                  {sr.ui.commandPalette.noResults}
                </li>
              ) : (
                filtered.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={item.id}
                      id={`${listboxId}-option-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-index={index}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-input)] px-2 py-2 text-left",
                        isActive ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      {item.icon ? (
                        <span className="shrink-0 text-text">{item.icon}</span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {item.label}
                        </span>
                        {item.hint ? (
                          <span className="block truncate text-xs text-muted">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
