import { ChevronDown } from "lucide-react";
import { getLandingFaqItems } from "@/content/faq";
import { sr } from "@/lib/i18n/sr";
import { textLinkClass } from "./landing-links";

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
        {getLandingFaqItems().map((item) => (
          <details
            key={item.id}
            className="group rounded-xl border border-border bg-surface"
          >
            <summary className="focus-ring flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 text-base font-semibold text-text [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                className="size-4 shrink-0 text-muted group-open:rotate-180 motion-safe:transition-transform"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
      <a href="/faq" className={`mt-3 ${textLinkClass}`}>{sr.marketing.landing.faqLink}</a>
    </div>
  );
}
