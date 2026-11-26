import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CalendarDays,
  ChefHat,
  ChevronDown,
  Package,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { SiteFooterLinks } from "@/components/legal/SiteFooterLinks";
import {
  primaryCtaClass,
  secondaryCtaClass,
  textLinkClass,
} from "@/components/marketing/landing-links";
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd";
import { MobileCta } from "@/components/marketing/MobileCta";
import { getBillingCatalog } from "@/lib/billing/catalog";
import { getPricingPlans } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata: Metadata = publicPageMetadata(
  sr.marketing.metaTitle,
  sr.marketing.metaDescription,
  "/",
);

const copy = sr.marketing.landing;

const features = [
  {
    icon: Calculator,
    title: copy.features[0].title,
    body: copy.features[0].body,
  },
  {
    icon: ChefHat,
    title: copy.features[1].title,
    body: copy.features[1].body,
  },
  {
    icon: TrendingUp,
    title: copy.features[2].title,
    body: copy.features[2].body,
  },
  {
    icon: CalendarDays,
    title: copy.features[3].title,
    body: copy.features[3].body,
  },
] as const;

const steps = copy.howSteps;
const faqItems = copy.faq;

const exampleRows = [
  { name: "Pileće meso", qty: "400 g", price: "1.350 din/kg", total: "540" },
  { name: "Šargarepa", qty: "200 g", price: "180 din/kg", total: "36" },
  { name: "Rezanci", qty: "100 g", price: "240 din/kg", total: "24" },
] as const;

const sectionTitle =
  "mb-6 text-balance text-ui-kpi font-semibold tracking-tight text-text";

export default async function MarketingPage() {
  const plans = getPricingPlans(await getBillingCatalog());

  return (
    <>
      <MarketingJsonLd plans={plans} />
      <main className="page-gutter mx-auto flex w-full max-w-app flex-col gap-16 pb-16 pt-10 sm:gap-20 lg:gap-24 lg:pt-16">
        <p
          id="nalog-obrisan"
          role="status"
          className="hidden scroll-mt-24 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text target:block"
        >
          {sr.auth.deleteAccountSuccess}
        </p>

        {/* 1. Hero */}
        <section
          aria-labelledby="hero-title"
          className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12"
        >
          <div className="flex min-w-0 flex-col gap-5">
            <p className="app-eyebrow">
              {copy.heroLabel}
            </p>
            <h1
              id="hero-title"
              className="max-w-[11.25em] text-balance text-[clamp(2.125rem,5.2vw,3.75rem)] leading-[1.08] font-semibold tracking-[-0.04em] text-text"
            >
              {"Znaj tačno "}<span className="landing-gradient-text">koliko košta svaka porcija.</span>
            </h1>
            <p
              className="max-w-lg text-base leading-relaxed text-text-2 sm:text-lg"
            >
              {copy.heroSubtitle}
            </p>
            <div
              className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap"
            >
              <Link
                id="landing-hero-cta"
                href="/login"
                prefetch={false}
                data-landing-cta="hero"
                className={`${primaryCtaClass} gap-2`}
              >
                {copy.primaryCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/kako-poceti" className={secondaryCtaClass}>
                {copy.secondaryCta}
              </Link>
            </div>
            <p
              className="flex items-center gap-2 text-sm text-text-2"
            >
              <Smartphone className="size-4 shrink-0 text-text-3" aria-hidden="true" />
              <span>{copy.deviceLine}</span>
            </p>
          </div>

          <div className="min-w-0">
            <article
              aria-label={copy.exampleAria}
              className="rounded-2xl border border-border-strong bg-surface p-4 shadow-[var(--shadow)] sm:p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">
                    {copy.exampleBadge}
                  </p>
                  <p className="mt-1 text-base font-semibold tracking-tight text-text sm:text-lg">
                    {copy.exampleTitle}
                  </p>
                </div>
                <Package className="size-5 shrink-0 text-accent" aria-hidden="true" />
              </div>

              <ul className="divide-y divide-border border-y border-border">
                {exampleRows.map((row) => (
                  <li
                    key={row.name}
                    className="grid grid-cols-[minmax(0,1fr)_4rem] gap-x-3 gap-y-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_4rem_6rem_4rem] sm:items-center"
                  >
                    <span className="font-medium text-text">{row.name}</span>
                    <span className="text-right tabular-nums text-text-2 sm:text-left">
                      {row.qty}
                    </span>
                    <span className="col-span-2 text-text-3 sm:col-span-1 sm:tabular-nums">
                      {row.price}
                    </span>
                    <span className="col-start-2 row-start-1 text-right font-semibold tabular-nums text-text sm:col-start-auto sm:row-start-auto">
                      {row.total} din
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-surface-2 px-3 py-3 sm:px-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-3">
                    {copy.exampleTotalLabel}
                  </p>
                  <p className="text-sm text-text-2">{copy.exampleMath}</p>
                </div>
                <p className="w-24 shrink-0 text-2xl font-semibold tabular-nums tracking-tight text-text">
                  {copy.examplePortion}
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* 2. Features */}
        <section id="features" aria-labelledby="features-title" className="scroll-mt-24">
          <h2 id="features-title" className={sectionTitle}>
            {copy.featuresTitle}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                tabIndex={0}
                className="landing-feature-card focus-ring rounded-xl border border-border bg-surface p-5 outline-none"
              >
                <Icon className="mb-4 size-6 text-accent" aria-hidden="true" />
                <h3 className="text-base font-semibold tracking-tight text-text">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 3. How it works */}
        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className={sectionTitle}>
            {sr.marketing.howLabel}
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
                <span
                  aria-hidden="true"
                  className="mb-4 inline-flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-ink"
                >
                  {index + 1}
                </span>
                <h3 className="text-base font-semibold tracking-tight text-text">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. FAQ */}
        <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-3xl">
          <h2 id="faq-heading" className={`${sectionTitle} text-center`}>
            {sr.marketing.faqTitle}
          </h2>
          <div className="flex flex-col gap-3">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group rounded-xl border border-border bg-surface"
              >
                <summary className="focus-ring flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 text-base font-semibold text-text [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted group-open:rotate-180 motion-safe:transition-transform"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-text-2">{item.answer}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className={`mt-3 ${textLinkClass}`}>
            {copy.faqLink}
          </Link>
        </section>

        {/* 5. Final CTA + footer */}
        <div id="landing-end" className="space-y-10">
          <section aria-labelledby="closing-title">
            <div className="flex flex-col gap-5 rounded-2xl border border-border-strong bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="min-w-0 max-w-xl">
                <h2
                  id="closing-title"
                  className="text-ui-kpi font-semibold tracking-tight text-text"
                >
                  {copy.closingTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text-2 sm:text-base">
                  {copy.closingBody}
                </p>
              </div>
              <Link
                href="/login"
                prefetch={false}
                data-landing-cta="footer"
                className={`${primaryCtaClass} w-full shrink-0 sm:w-auto`}
              >
                {copy.primaryCta}
              </Link>
            </div>
          </section>

          <footer className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p className="text-sm font-semibold text-text">{sr.app.name}</p>
              <nav aria-label="Podnožje" className="flex flex-wrap gap-x-4 text-sm">
                <Link href="/kako-poceti" className={textLinkClass}>
                  {copy.footerHow}
                </Link>
                <Link href="/premium" className={textLinkClass}>
                  {copy.footerPremium}
                </Link>
                <Link href="/login" prefetch={false} className={textLinkClass}>
                  {sr.marketing.footerLogin}
                </Link>
              </nav>
            </div>
            <SiteFooterLinks className="mt-2" />
          </footer>
        </div>
      </main>
      <MobileCta label={copy.primaryCta} />
    </>
  );
}
