"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  searchFaqItems,
  type FaqCategory,
  type FaqItem,
} from "@/content/faq";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type FaqAccordionProps = {
  items?: readonly FaqItem[];
  /** Full page mode: search + category filters */
  searchable?: boolean;
  title?: string | null;
  initiallyOpen?: boolean;
};

export function FaqAccordion({
  items = FAQ_ITEMS,
  searchable = false,
  title = sr.legal.faqTitle,
  initiallyOpen = false,
}: FaqAccordionProps) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(
    initiallyOpen && items[0] ? items[0].id : null
  );

  const filtered = useMemo(() => {
    if (!searchable) return [...items];
    return searchFaqItems(query, category, items);
  }, [searchable, query, category, items]);

  return (
    <div className="w-full">
      {title ? (
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-text">
          {title}
        </h1>
      ) : null}

      {searchable ? (
        <div className="mb-6 space-y-4">
          <p className="text-sm text-muted">{sr.legal.faqIntro}</p>
          <div>
            <label htmlFor={`${baseId}-search`} className="field-label">{sr.common.search}</label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                id={`${baseId}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={sr.legal.faqSearchPlaceholder}
                className="focus-ring min-h-11 w-full rounded-[var(--radius-input)] border border-border bg-surface py-2 pl-10 pr-3 text-sm text-text placeholder:text-muted"
              />
            </div>
          </div>
          <nav
            aria-label={sr.legal.tocLabel}
            className="flex flex-wrap gap-2"
          >
            <FilterChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label={sr.common.all}
            />
            {FAQ_CATEGORIES.map((name) => (
              <FilterChip
                key={name}
                active={category === name}
                onClick={() => setCategory(name)}
                label={name}
              />
            ))}
          </nav>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {sr.common.noResults}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((item, index) => {
            const isOpen = openId === item.id;
            const panelId = `${baseId}-panel-${item.id}`;
            const buttonId = `${baseId}-button-${item.id}`;

            return (
              <div
                key={item.id}
                className="mb-3 rounded-xl border border-border bg-surface last:mb-0"
              >
                <h2 className="text-base font-semibold">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                        return;
                      }
                      event.preventDefault();
                      const nextIndex =
                        event.key === "ArrowDown"
                          ? Math.min(index + 1, filtered.length - 1)
                          : Math.max(index - 1, 0);
                      const next = filtered[nextIndex];
                      if (!next) return;
                      setOpenId(next.id);
                      requestAnimationFrame(() => {
                        document
                          .getElementById(`${baseId}-button-${next.id}`)
                          ?.focus();
                      });
                    }}
                    className={cn(
                      "focus-ring flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl px-5 text-left",
                      "text-ui-base font-semibold text-text outline-none"
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      {searchable ? (
                        <span className="text-xs font-medium text-muted">
                          {item.category}
                        </span>
                      ) : null}
                      <span>{item.question}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-text-2",
                        "motion-safe:transition-transform motion-safe:duration-200",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                </h2>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={cn(
                    "px-5 pb-5 text-ui-base text-text-2",
                    !isOpen && "hidden"
                  )}
                >
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-ring min-h-10 rounded-full border px-3 text-sm",
        active
          ? "border-accent bg-accent/15 font-semibold text-text"
          : "border-border bg-surface text-muted hover:text-text"
      )}
    >
      {label}
    </button>
  );
}
