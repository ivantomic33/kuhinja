import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Calculator, CalendarDays, Carrot, ChefHat, ClipboardList, Package, WifiOff } from "lucide-react";
import { SiteFooterLinks } from "@/components/legal/SiteFooterLinks";
import { MarketingFaq } from "@/components/marketing/MarketingFaq";
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd";
import { MobileCta } from "@/components/marketing/MobileCta";
import { PricingTable } from "@/components/marketing/PricingTable";
import { SocialProof } from "@/components/marketing/SocialProof";
import { primaryCtaClass, secondaryCtaClass, textLinkClass, trialHref } from "@/components/marketing/landing-links";
import { getBillingCatalog } from "@/lib/billing/catalog";
import { getPricingPlans } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata: Metadata = publicPageMetadata(
  sr.marketing.metaTitle, sr.marketing.metaDescription, "/",
);

const copy = sr.marketing.landing;
const featureIcons = [Carrot, ChefHat, Calculator, Package, ClipboardList, CalendarDays];
const steps = [
  { ...copy.steps[0], image: "ingredients", height: 630 },
  { ...copy.steps[1], image: "recipe", height: 430, alt: copy.previewAlt },
  { ...copy.steps[2], image: "shift", height: 530 },
] as const;
const sectionTitle = "mb-6 text-ui-kpi font-semibold tracking-tight text-text";
const card = "rounded-xl border border-border bg-surface p-5";
const paragraph = "mt-2 text-sm leading-relaxed text-text-2";

export default async function MarketingPage() {
  const plans = getPricingPlans(await getBillingCatalog());

  return (
    <>
      <MarketingJsonLd plans={plans} />
      <main className="page-gutter mx-auto flex w-full max-w-app flex-col gap-14 pb-10 pt-10 lg:gap-20 lg:pt-20">
        <p id="nalog-obrisan" role="status" className="hidden scroll-mt-24 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text target:block">
          {sr.auth.deleteAccountSuccess}
        </p>

        <section aria-labelledby="hero-title" className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <div className="flex flex-col gap-5">
            <h1 id="hero-title" className="max-w-[13ch] text-balance text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.06] font-semibold tracking-[-0.045em] text-text">
              {copy.heroTitle}
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-text-2 sm:text-lg">{copy.heroSubtitle}</p>
            <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <a id="landing-hero-cta" href={trialHref} data-landing-cta="hero" className={`${primaryCtaClass} gap-2`}>
                {copy.trialCta}<ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a href="#cenovnik" className={secondaryCtaClass}>{copy.plansCta}</a>
            </div>
          </div>

          <figure className="min-w-0 rounded-2xl border border-border-strong bg-surface px-2 pt-2">
            <Image
              src="/landing/recipe.avif"
              width={960}
              height={430}
              sizes="(max-width: 1023px) calc(100vw - 48px), (max-width: 1400px) 50vw, 690px"
              priority
              alt={copy.previewAlt}
              className="h-auto w-full rounded-xl"
            />
            <figcaption className="px-2 py-3 text-xs font-medium text-text-2">{copy.previewCaption}</figcaption>
          </figure>
        </section>

        <section aria-labelledby="outcomes-title">
          <h2 id="outcomes-title" className={sectionTitle}>{copy.outcomesTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {copy.outcomes.map(({ title, body }) => (
              <article key={title} className={card}>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className={paragraph}>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-24">
          <h2 id="features-title" className={sectionTitle}>{copy.modulesTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {copy.modules.map(({ title, body }, index) => {
              const Icon = featureIcons[index];
              return (
                <article key={title} className={card}>
                  <Icon className="mb-4 size-6 text-accent" aria-hidden="true" />
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className={paragraph}>{body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className={sectionTitle}>{sr.marketing.howLabel}</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map(({ title, image, height, alt }, index) => (
              <li key={image} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-3 p-4">
                  <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-ink">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <Image
                  src={`/landing/${image}.avif`}
                  width={960}
                  height={height}
                  sizes="(max-width: 639px) 100vw, 33vw"
                  alt={alt}
                  className="h-auto w-full border-t border-border"
                />
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="offline-title" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <WifiOff className="size-6 shrink-0 text-accent" aria-hidden="true" />
            <h2 id="offline-title" className="text-ui-kpi font-semibold tracking-tight">{copy.offlineTitle}</h2>
          </div>
          <ul className="my-4 ml-5 list-disc space-y-2 text-sm leading-relaxed text-text-2">
            {copy.offline.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <a href="/faq" className={textLinkClass}>{copy.offlineLink}</a>
        </section>

        <section id="cenovnik" aria-labelledby="pricing-title" className="scroll-mt-24">
          <span id="pricing" className="block scroll-mt-24" />
          <h2 id="pricing-title" className={sectionTitle}>{copy.pricing}</h2>
          <PricingTable plans={plans} />
        </section>

        <SocialProof />

        <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-3xl">
          <MarketingFaq />
        </section>

        <div id="landing-end" className="space-y-10">
          <section aria-labelledby="closing-title" className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-border-strong bg-surface p-6 sm:p-8">
            <h2 id="closing-title" className="text-ui-kpi font-semibold tracking-tight">{copy.closingTitle}</h2>
            <a href={trialHref} data-landing-cta="footer" className={primaryCtaClass}>{copy.trialCta}</a>
          </section>
          <footer className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6">
              <p className="text-sm font-semibold">{sr.app.name}</p>
              <nav aria-label="Podnožje" className="flex flex-wrap gap-x-4 text-sm">
                <a href="/login" className={textLinkClass}>{sr.marketing.footerLogin}</a>
                <a href="/register" className={textLinkClass}>{sr.marketing.footerRegister}</a>
                <a href="#cenovnik" className={textLinkClass}>{copy.pricing}</a>
              </nav>
            </div>
            <SiteFooterLinks />
          </footer>
        </div>
      </main>
      <MobileCta />
    </>
  );
}
