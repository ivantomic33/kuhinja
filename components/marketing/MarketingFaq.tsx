import { ChevronDown } from "lucide-react";
import { sr } from "@/lib/i18n/sr";

const ITEMS = [
  { q: sr.marketing.faq1Q, a: sr.marketing.faq1A },
  { q: sr.marketing.faq2Q, a: sr.marketing.faq2A },
  { q: sr.marketing.faq3Q, a: sr.marketing.faq3A },
  { q: sr.marketing.faq4Q, a: sr.marketing.faq4A },
  { q: sr.marketing.faq5Q, a: sr.marketing.faq5A },
] as const;

/** Server-rendered FAQ. Answers stay in the HTML for crawlers. */
export function MarketingFaq() {
  return (
    <div className="w-full">
      <h2
        id="faq-heading"
        className="mb-5 text-center text-2xl font-semibold tracking-tight text-text"
      >
        {sr.marketing.faqTitle}
      </h2>
      <div className="flex flex-col gap-3">
        {ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-surface"
          >
            <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-text [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
