"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

const FAQS = [
  { q: sr.marketing.faq1Q, a: sr.marketing.faq1A },
  { q: sr.marketing.faq2Q, a: sr.marketing.faq2A },
  { q: sr.marketing.faq3Q, a: sr.marketing.faq3A },
  { q: sr.marketing.faq4Q, a: sr.marketing.faq4A },
  { q: sr.marketing.faq5Q, a: sr.marketing.faq5A },
] as const;

type FaqItem = {
  q: string;
  a: ReactNode;
};

type FaqAccordionProps = {
  items?: readonly FaqItem[];
  title?: string;
  initiallyOpen?: boolean;
};

export function FaqAccordion({
  items = FAQS,
  title = sr.marketing.faqTitle,
  initiallyOpen = true,
}: FaqAccordionProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(initiallyOpen ? 0 : null);

  return (
    <section className="w-full">
      {title ? (
        <h2 className="mb-5 text-center text-ui-xl font-semibold text-text">
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `${baseId}-panel-${index}`;
          const buttonId = `${baseId}-button-${index}`;

          return (
            <div
              key={item.q}
              className="mb-3 rounded-xl border border-border bg-surface last:mb-0"
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className={cn(
                    "focus-ring flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl px-5 text-left",
                    "text-ui-base font-semibold text-text outline-none"
                  )}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-text-2",
                      "motion-safe:transition-transform motion-safe:duration-200",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
              </h3>
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
                {item.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
