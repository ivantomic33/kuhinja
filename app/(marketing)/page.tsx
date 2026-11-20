import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Calculator,
  Check,
  ClipboardList,
  Scale,
  Sparkles,
} from "lucide-react";
import { FoodCostMockup } from "@/components/marketing/FoodCostMockup";
import { MarketingFaq } from "@/components/marketing/MarketingFaq";
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd";
import { BentoCard } from "@/components/ui/BentoCard";
import { sr } from "@/lib/i18n/sr";
import { getSiteUrl } from "@/lib/seo/site";
import { cn } from "@/lib/utils/cn";

const priceFormat = new Intl.NumberFormat("sr-Latn", {
  maximumFractionDigits: 0,
});

export const metadata: Metadata = {
  title: { absolute: sr.marketing.metaTitle },
  description: sr.marketing.metaDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: sr.marketing.metaTitle,
    description: sr.marketing.metaDescription,
    url: "/",
  },
  twitter: {
    title: sr.marketing.metaTitle,
    description: sr.marketing.metaDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const FEATURES = [
  {
    key: "foodcost",
    icon: Calculator,
    title: sr.marketing.feature1Title,
    body: sr.marketing.feature1Body,
  },
  {
    key: "scaler",
    icon: Scale,
    title: sr.marketing.feature2Title,
    body: sr.marketing.feature2Body,
  },
  {
    key: "shift",
    icon: ClipboardList,
    title: sr.marketing.feature3Title,
    body: sr.marketing.feature3Body,
  },
] as const;

const STEPS = [
  { title: sr.marketing.step1Title, body: sr.marketing.step1Body },
  { title: sr.marketing.step2Title, body: sr.marketing.step2Body },
  { title: sr.marketing.step3Title, body: sr.marketing.step3Body },
] as const;

const FREE_FEATURES = [
  sr.marketing.freeFeat1,
  sr.marketing.freeFeat2,
  sr.marketing.freeFeat3,
  sr.marketing.freeFeat4,
] as const;

const PREMIUM_FEATURES = [
  sr.marketing.premiumFeat1,
  sr.marketing.premiumFeat2,
  sr.marketing.premiumFeat3,
  sr.marketing.premiumFeat4,
] as const;

function CtaLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-[52px] items-center justify-center gap-1",
        "rounded-[var(--radius-input)] px-6 text-base font-semibold",
        "outline-none transition-opacity",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-hover",
        variant === "ghost" &&
          "border border-border bg-surface-2 text-text hover:opacity-90",
        className
      )}
    >
      {children}
    </Link>
  );
}

export default function MarketingPage() {
  return (
    <>
      <MarketingJsonLd siteUrl={getSiteUrl()} />

      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-20 px-5 py-12 sm:px-8 lg:gap-24 lg:py-20">
        <section aria-labelledby="hero-title" className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-7">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              {sr.marketing.heroEyebrow}
            </p>
            <h1 id="hero-title" className="max-w-xl text-balance text-[44px] font-semibold leading-[1.08] tracking-[-0.05em] text-text sm:text-6xl xl:text-[68px]">
              {sr.marketing.heroTitle}
            </h1>
            <p className="max-w-lg text-pretty text-lg leading-relaxed text-muted">
              {sr.marketing.heroSubtitle}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/register">{sr.marketing.ctaRegister}</CtaLink>
              <CtaLink href="#mockup" variant="ghost">{sr.marketing.ctaTry}</CtaLink>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Check className="size-4" aria-hidden="true" />
              {sr.marketing.freeNote}
            </p>
          </div>
          <div id="mockup" className="min-w-0 scroll-mt-24"><FoodCostMockup /></div>
        </section>

        <section aria-label={sr.marketing.howLabel} className="grid gap-6 border-y border-border py-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title}>
              <p className="mb-2 text-base font-semibold">{step.title}</p>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </section>

        <section
          id="features" aria-labelledby="features-title"
          className="flex flex-col gap-7"
        >
          <h2
            id="features-title"
            className="text-3xl font-semibold tracking-tight text-text"
          >
            {sr.marketing.featuresTitle}
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.key} className="flex flex-col gap-4 border-t border-border pt-6">
                  <div
                    className={cn(
                      "inline-flex size-9 items-center justify-center",
                      "rounded-[var(--radius-input)] bg-surface-2 text-muted"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-text">
                    {feature.title}
                  </h3>
                  <p className="text-base leading-relaxed text-muted">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="pricing" aria-labelledby="pricing-title"
          className="flex flex-col gap-7"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="pricing-title"
              className="text-lg font-semibold tracking-tight text-text"
            >
              {sr.marketing.pricingTitle}
            </h2>
            <p className="text-sm text-muted">{sr.marketing.pricingSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <BentoCard
              header={
                <div className="flex w-full items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-text">
                    {sr.marketing.freeName}
                  </h3>
                </div>
              }
              footer={
                <CtaLink href="/register" variant="ghost" className="w-full">
                  {sr.marketing.freeCta}
                </CtaLink>
              }
            >
              <div className="flex flex-col gap-1">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-text">
                  {priceFormat.format(0)} {sr.premium.currency}
                </p>
                <p className="text-sm text-muted">{sr.marketing.freeHint}</p>
              </div>
              <ul className="flex flex-col gap-1">
                {FREE_FEATURES.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-1 text-sm text-text"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </BentoCard>

            <BentoCard
              className="border-accent/30"
              header={
                <div className="flex w-full items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-text">
                    {sr.marketing.premiumName}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    <Sparkles className="size-3" aria-hidden />
                    {sr.premium.badge}
                  </span>
                </div>
              }
              footer={
                <CtaLink href="/register" className="w-full">
                  {sr.marketing.premiumCta}
                </CtaLink>
              }
            >
              <div className="flex flex-col gap-1">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-text">
                  {priceFormat.format(sr.premium.priceMonthly)}
                </p>
                <p className="text-sm text-muted">{sr.marketing.perMonth}</p>
                <p className="text-sm text-muted">{sr.marketing.premiumHint}</p>
              </div>
              <ul className="flex flex-col gap-1">
                {PREMIUM_FEATURES.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-1 text-sm text-text"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      aria-hidden
                    />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </BentoCard>
          </div>
        </section>

        <section aria-labelledby="faq-heading">
          <MarketingFaq />
        </section>

        <section className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-surface p-7 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{sr.marketing.closingTitle}</h2>
            <p className="mt-3 text-base text-muted">{sr.marketing.closingBody}</p>
          </div>
          <CtaLink href="/register">{sr.marketing.ctaRegister}</CtaLink>
        </section>

        <footer className="border-t border-border pt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-text">{sr.app.name}</p>
              <p className="text-sm text-muted">{sr.marketing.footerTagline}</p>
              <p className="text-xs text-muted">
                © {new Date().getFullYear()} {sr.app.name}.{" "}
                {sr.marketing.footerRights}
              </p>
            </div>
            <nav
              aria-label="Footer"
              className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
            >
              <Link
                href="/login"
                className="text-muted hover:text-text"
              >
                {sr.marketing.footerLogin}
              </Link>
              <Link
                href="/register"
                className="text-muted hover:text-text"
              >
                {sr.marketing.footerRegister}
              </Link>
              <Link
                href="/#pricing"
                className="text-muted hover:text-text"
              >
                {sr.marketing.footerPremium}
              </Link>
            </nav>
          </div>
        </footer>
      </main>
    </>
  );
}
